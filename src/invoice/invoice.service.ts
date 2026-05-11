import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
import { v4 } from 'uuid';

export interface CreateInvoiceItemDto {
  productId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  isCustom?: boolean;
}

export interface CreateInvoiceDto {
  userId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: CreateInvoiceItemDto[];
  memo?: string;
}

export interface AddInvoicePaymentDto {
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  userId: string;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private buildProductName(product: {
    category: string;
    classLevel?: string | null;
    subject?: string | null;
  }) {
    return [product.category, product.classLevel, product.subject]
      .filter(Boolean)
      .join(' - ');
  }

  async create(createInvoiceDto: CreateInvoiceDto) {
    try {
      const invoiceId = `INV-${Date.now()}-${v4().substring(0, 8)}`;

      const user = await this.prisma.user.findUnique({
        where: { id: createInvoiceDto.userId },
        select: { id: true, branchId: true },
      });

      if (!user) {
        throw new InternalServerErrorException('User not found');
      }

      let resolvedCustomerId = createInvoiceDto.customerId?.trim() || undefined;

      if (resolvedCustomerId) {
        const customerExists = await this.prisma.customer.findUnique({
          where: { id: resolvedCustomerId },
          select: { id: true },
        });

        if (!customerExists) {
          const customerName =
            createInvoiceDto.customerName?.trim() || resolvedCustomerId;

          if (customerName) {
            if (!user.branchId) {
              throw new InternalServerErrorException(
                'Customer branch is required before creating a new customer',
              );
            }

            const createdCustomer = await this.prisma.customer.create({
              data: {
                name: customerName,
                phoneNumber:
                  createInvoiceDto.customerPhone?.trim() || `INV-${Date.now()}`,
                address: createInvoiceDto.customerAddress?.trim() || undefined,
                branchId: user.branchId,
              },
              select: { id: true },
            });

            resolvedCustomerId = createdCustomer.id;

            await this.auditService.log({
              userId: createInvoiceDto.userId,
              action: 'CUSTOMER_CREATED_FROM_INVOICE',
              entity: 'Customer',
              entityId: createdCustomer.id,
              after: {
                name: customerName,
                phoneNumber: createInvoiceDto.customerPhone?.trim() || null,
                address: createInvoiceDto.customerAddress?.trim() || null,
                branchId: user.branchId,
              },
            });
          } else {
            resolvedCustomerId = undefined;
          }
        }
      } else if (createInvoiceDto.customerName?.trim()) {
        if (!user.branchId) {
          throw new InternalServerErrorException(
            'Customer branch is required before creating a new customer',
          );
        }

        const createdCustomer = await this.prisma.customer.create({
          data: {
            name: createInvoiceDto.customerName.trim(),
            phoneNumber:
              createInvoiceDto.customerPhone?.trim() || `INV-${Date.now()}`,
            address: createInvoiceDto.customerAddress?.trim() || undefined,
            branchId: user.branchId,
          },
          select: { id: true },
        });

        resolvedCustomerId = createdCustomer.id;

        await this.auditService.log({
          userId: createInvoiceDto.userId,
          action: 'CUSTOMER_CREATED_FROM_INVOICE',
          entity: 'Customer',
          entityId: createdCustomer.id,
          after: {
            name: createInvoiceDto.customerName.trim(),
            phoneNumber: createInvoiceDto.customerPhone?.trim() || null,
            address: createInvoiceDto.customerAddress?.trim() || null,
            branchId: user.branchId,
          },
        });
      }

      let totalAmount = 0;
      const processedItems: CreateInvoiceItemDto[] = [];

      // Validate and process items
      for (const item of createInvoiceDto.items) {
        const product = item.productId
          ? await this.prisma.product.findUnique({
              where: { id: item.productId },
              select: { id: true, category: true, classLevel: true, subject: true, price: true, costPrice: true },
            })
          : null;

        const resolvedItemName = item.itemName?.trim() || (product ? this.buildProductName(product) : '');
        const resolvedUnitPrice = item.unitPrice > 0 ? item.unitPrice : (product?.price ?? 0);

        if (!resolvedItemName) {
          throw new InternalServerErrorException(
            'Each invoice item needs a name or a selected product',
          );
        }

        if (resolvedUnitPrice <= 0) {
          throw new InternalServerErrorException(
            'Each invoice item needs a valid price or a selected product',
          );
        }

        const lineTotal = item.quantity * resolvedUnitPrice;
        totalAmount += lineTotal;

        if (!item.isCustom && item.productId) {
          if (!product) {
            throw new InternalServerErrorException(
              `Product ${item.productId} not found`,
            );
          }
        }

        processedItems.push({
          ...item,
          itemName: resolvedItemName,
          unitPrice: resolvedUnitPrice,
        });
      }

      // Create invoice
      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceId,
          userId: createInvoiceDto.userId,
          customerId: resolvedCustomerId,
          totalAmount,
          amountDue: totalAmount,
          memo: createInvoiceDto.memo ?? null,
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId ?? undefined,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
              isCustom: item.isCustom ?? false,
            })),
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          customer: true,
          items: { include: { product: true } },
          payments: true,
        },
      });

      // Log to audit
      await this.auditService.log({
        userId: createInvoiceDto.userId,
        action: 'INVOICE_CREATED',
        entity: 'Invoice',
        entityId: invoice.id,
        after: {
          invoiceId: invoice.invoiceId,
          totalAmount,
          itemCount: processedItems.length,
          customerId: resolvedCustomerId,
        },
      });

      return invoice;
    } catch (error: unknown) {
      console.error('Error creating invoice:', error);
      throw new InternalServerErrorException({
        message: 'Failed to create invoice',
        error,
      });
    }
  }

  async findAll(page: number, limit: number, status?: string, userId?: string) {
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        customer: true,
        items: { include: { product: true } },
        payments: { select: { id: true, amount: true, createdAt: true } },
      },
    });

    const total = await this.prisma.invoice.count({ where });

    return {
      data: invoices,
      totalPages: Math.ceil(total / limit),
      total,
    };
  }

  async findOne(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: { select: { id: true, name: true, email: true, branchId: true, branch: { select: { id: true, name: true } } } },
        customer: true,
        items: { include: { product: true } },
        payments: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!invoice) {
      throw new InternalServerErrorException('Invoice not found');
    }

    return invoice;
  }

  async addPayment(invoiceId: string, addPaymentDto: AddInvoicePaymentDto) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new InternalServerErrorException('Invoice not found');
      }

      if (invoice.status === 'CONVERTED') {
        throw new InternalServerErrorException(
          'Cannot add payment to converted invoice',
        );
      }

      const payment = await this.prisma.invoicePayment.create({
        data: {
          invoiceId,
          amount: addPaymentDto.amount,
          paymentMethod: (addPaymentDto.paymentMethod ?? 'CASH') as any,
          reference: addPaymentDto.reference ?? null,
          notes: addPaymentDto.notes ?? null,
          userId: addPaymentDto.userId,
        },
      });

      const newAmountPaid = invoice.amountPaid + addPaymentDto.amount;
      const newAmountDue = Math.max(0, invoice.totalAmount - newAmountPaid);
      const newStatus =
        newAmountDue === 0
          ? 'PAID'
          : newAmountPaid > 0
            ? 'PAID'
            : invoice.status;

      const updatedInvoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          customer: true,
          items: true,
          payments: true,
        },
      });

      // Log payment to audit
      await this.auditService.log({
        userId: addPaymentDto.userId,
        action: 'INVOICE_PAYMENT',
        entity: 'InvoicePayment',
        entityId: payment.id,
        after: {
          invoiceId: invoice.invoiceId,
          amount: addPaymentDto.amount,
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      return updatedInvoice;
    } catch (error: unknown) {
      console.error('Error adding payment:', error);
      throw new InternalServerErrorException({
        message: 'Failed to add payment',
        error,
      });
    }
  }

  async convertToSale(invoiceId: string, userId: string) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          user: { select: { id: true, role: true, branchId: true, branch: { select: { id: true, name: true } } } },
          items: { include: { product: true } },
        },
      });

      if (!invoice) {
        throw new InternalServerErrorException('Invoice not found');
      }

      if (invoice.amountPaid === 0) {
        throw new InternalServerErrorException(
          'Cannot convert unpaid invoice to sale. Payment required first.',
        );
      }

      if (invoice.status === 'CONVERTED') {
        throw new InternalServerErrorException('Invoice already converted to sale');
      }

      // For office users, validate branch stock
      if (invoice.user.role === 'office') {
        for (const item of invoice.items) {
          if (item.productId) {
            const branchStock = await this.prisma.branchStock.findUnique({
              where: {
                branchId_productId: {
                  branchId: invoice.user.branchId!,
                  productId: item.productId,
                },
              },
            });

            const availableQuantity = branchStock?.quantity ?? 0;
            if (item.quantity > availableQuantity) {
              throw new InternalServerErrorException(
                `Insufficient stock for ${item.itemName} in branch ${invoice.user.branch?.name}. Available: ${availableQuantity}`,
              );
            }
          }
        }
      }

      // Create sales from invoice items
      const data: any[] = [];
      const orderId = `ORD-${Date.now()}-${v4().substring(0, 8)}`;
      const saleRecords: any[] = [];

      for (const item of invoice.items) {
        // For office users, decrement branch stock
        if (invoice.user.role === 'office' && item.productId) {
          const branchStock = await this.prisma.branchStock.findUnique({
            where: {
              branchId_productId: {
                branchId: invoice.user.branchId!,
                productId: item.productId,
              },
            },
          });

          if (branchStock) {
            await this.prisma.branchStock.update({
              where: { id: branchStock.id },
              data: {
                quantity: Math.max(0, branchStock.quantity - item.quantity),
              },
            });
          }
        } else if (item.productId) {
          // For other users, decrement global stock
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
          });

          if (product) {
            await this.prisma.product.update({
              where: { id: item.productId },
              data: {
                totalStock: Math.max(0, product.totalStock - item.quantity),
              },
            });
          }
        }

        // Create sale record
        const sale = await this.prisma.sale.create({
          data: {
            orderId,
            repId: invoice.user.id,
            productId: item.productId ?? undefined,
            itemName: item.itemName,
            itemType: item.isCustom ? 'CUSTOM' : 'PRODUCT',
            quantity: item.quantity,
            customerId: invoice.customerId ?? undefined,
            unitPrice: item.unitPrice,
            unitCost: item.product?.costPrice ?? 0,
            memo: `Converted from invoice ${invoice.invoiceId}`,
            onCredit: true,
          },
        });

        saleRecords.push(sale);
      }

      // Mark invoice as converted
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CONVERTED',
          convertedToSaleId: orderId,
        },
        include: {
          user: { select: { id: true, name: true } },
          items: true,
        },
      });

      // Log conversion to audit
      await this.auditService.log({
        userId,
        action: 'INVOICE_CONVERTED_TO_SALE',
        entity: 'Invoice',
        entityId: invoiceId,
        after: {
          invoiceId: invoice.invoiceId,
          convertedToSaleId: orderId,
          itemCount: saleRecords.length,
          totalAmount: invoice.totalAmount,
        },
      });

      return {
        invoice: updatedInvoice,
        saleRecords,
        orderId,
      };
    } catch (error: unknown) {
      console.error('Error converting invoice to sale:', error);
      throw new InternalServerErrorException({
        message: 'Failed to convert invoice to sale',
        error,
      });
    }
  }

  async delete(invoiceId: string, userId: string) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new InternalServerErrorException('Invoice not found');
      }

      if (invoice.status === 'CONVERTED') {
        throw new InternalServerErrorException(
          'Cannot delete converted invoice',
        );
      }

      // Delete invoice and cascade to items and payments
      await this.prisma.invoice.delete({
        where: { id: invoiceId },
      });

      // Log deletion
      await this.auditService.log({
        userId,
        action: 'INVOICE_DELETED',
        entity: 'Invoice',
        entityId: invoiceId,
        after: {
          invoiceId: invoice.invoiceId,
          status: invoice.status,
        },
      });

      return { ok: true };
    } catch (error: unknown) {
      console.error('Error deleting invoice:', error);
      throw new InternalServerErrorException({
        message: 'Failed to delete invoice',
        error,
      });
    }
  }
}
