import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseOrderPaymentStatus, PurchaseOrderPaymentTerms, PurchaseOrderStatus } from '@prisma/client';
import { AuditService } from 'src/audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePurchaseOrderPaymentDto } from './dto/create-purchase-order-payment.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) { }

  private buildPaymentStatus(amountPaid: number, totalPrice: number): PurchaseOrderPaymentStatus {
    if (amountPaid <= 0) return PurchaseOrderPaymentStatus.UNPAID;
    if (amountPaid >= totalPrice) return PurchaseOrderPaymentStatus.PAID;
    return PurchaseOrderPaymentStatus.PARTIALLY_PAID;
  }

  async create(createSupplierDto: CreateSupplierDto) {
    const { products, ...supplierData } = createSupplierDto;

    const supplier = await this.prisma.supplier.create({
      data: {
        ...supplierData,
        supplierProducts: products?.length
          ? {
              create: products.map((product) => ({
                name: product.name,
                price: product.price,
                memo: product.memo,
              })),
            }
          : undefined,
      },
      include: {
        supplierProducts: true,
      },
    });

    await this.auditService.log({
      action: 'SUPPLIER_CREATED',
      entity: 'Supplier',
      entityId: supplier.id,
      after: supplier,
    });

    return supplier;
  }

  async findAll(page: number, limit: number) {
    const data = await this.prisma.supplier.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            supplierProducts: true,
            purchaseOrders: true,
          },
        },
      },
    });

    const total = await this.prisma.supplier.count();
    const totalPages = Math.ceil(total / limit);
    return { data, totalPages };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        supplierProducts: {
          orderBy: { createdAt: 'desc' },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            product: true,
            payments: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    const { products, ...data } = updateSupplierDto;
    const before = await this.prisma.supplier.findUnique({ where: { id } });

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      action: 'SUPPLIER_UPDATED',
      entity: 'Supplier',
      entityId: id,
      before,
      after: supplier,
    });

    return supplier;
  }

  async remove(id: string) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    const supplier = await this.prisma.supplier.delete({
      where: { id },
    });

    await this.auditService.log({
      action: 'SUPPLIER_DELETED',
      entity: 'Supplier',
      entityId: id,
      before,
    });

    return supplier;
  }

  async createSupplierProduct(createSupplierProductDto: CreateSupplierProductDto) {
    const supplierExists = await this.prisma.supplier.findUnique({
      where: { id: createSupplierProductDto.supplierId },
      select: { id: true },
    });

    if (!supplierExists) {
      throw new NotFoundException('Supplier not found');
    }

    const product = await this.prisma.supplierProduct.create({
      data: createSupplierProductDto,
    });

    await this.auditService.log({
      action: 'SUPPLIER_PRODUCT_CREATED',
      entity: 'SupplierProduct',
      entityId: product.id,
      after: product,
    });

    return product;
  }

  async findSupplierProducts(supplierId?: string, page = 1, limit = 20) {
    const where = supplierId ? { supplierId } : {};

    const data = await this.prisma.supplierProduct.findMany({
      skip: (page - 1) * limit,
      take: limit,
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.supplierProduct.count({ where });
    const totalPages = Math.ceil(total / limit);
    return { data, totalPages };
  }

  async updateSupplierProduct(id: string, updateSupplierProductDto: UpdateSupplierProductDto) {
    const before = await this.prisma.supplierProduct.findUnique({ where: { id } });
    const product = await this.prisma.supplierProduct.update({
      where: { id },
      data: updateSupplierProductDto,
    });

    await this.auditService.log({
      action: 'SUPPLIER_PRODUCT_UPDATED',
      entity: 'SupplierProduct',
      entityId: id,
      before,
      after: product,
    });

    return product;
  }

  async removeSupplierProduct(id: string) {
    const before = await this.prisma.supplierProduct.findUnique({ where: { id } });
    const product = await this.prisma.supplierProduct.delete({
      where: { id },
    });

    await this.auditService.log({
      action: 'SUPPLIER_PRODUCT_DELETED',
      entity: 'SupplierProduct',
      entityId: id,
      before,
    });

    return product;
  }

  async createPurchaseOrder(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    const product = await this.prisma.supplierProduct.findUnique({
      where: { id: createPurchaseOrderDto.productId },
      select: {
        id: true,
        supplierId: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Supplier product not found');
    }

    if (product.supplierId !== createPurchaseOrderDto.supplierId) {
      throw new BadRequestException('Supplier product does not belong to the provided supplier');
    }

    const totalPrice = createPurchaseOrderDto.quantity * createPurchaseOrderDto.unitPrice;
    const amountPaid = createPurchaseOrderDto.amountPaid ?? 0;

    if (amountPaid > totalPrice) {
      throw new BadRequestException('Amount paid cannot be greater than total price');
    }

    const amountDue = totalPrice - amountPaid;
    const paymentStatus = this.buildPaymentStatus(amountPaid, totalPrice);

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        orderId: createPurchaseOrderDto.orderId ?? `PO-${Date.now()}`,
        supplierId: createPurchaseOrderDto.supplierId,
        productId: createPurchaseOrderDto.productId,
        quantity: createPurchaseOrderDto.quantity,
        unitPrice: createPurchaseOrderDto.unitPrice,
        totalPrice,
        amountPaid,
        amountDue,
        paymentTerms: createPurchaseOrderDto.paymentTerms ?? PurchaseOrderPaymentTerms.FULL,
        paymentStatus,
        status: createPurchaseOrderDto.status ?? PurchaseOrderStatus.PENDING,
        payments:
          amountPaid > 0
            ? {
                create: {
                  amount: amountPaid,
                },
              }
            : undefined,
      },
      include: {
        supplier: true,
        product: true,
        payments: true,
      },
    });

    await this.auditService.log({
      action: 'PURCHASE_ORDER_CREATED',
      entity: 'PurchaseOrder',
      entityId: purchaseOrder.id,
      after: purchaseOrder,
    });

    return purchaseOrder;
  }

  async addPurchaseOrderPayment(purchaseOrderId: string, paymentDto: CreatePurchaseOrderPaymentDto) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        totalPrice: true,
        amountPaid: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    const nextPaid = order.amountPaid + paymentDto.amount;

    if (nextPaid > order.totalPrice) {
      throw new BadRequestException('Payment exceeds outstanding amount');
    }

    const nextDue = order.totalPrice - nextPaid;
    const nextStatus = this.buildPaymentStatus(nextPaid, order.totalPrice);

    return this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderPayment.create({
        data: {
          purchaseOrderId,
          amount: paymentDto.amount,
          method: paymentDto.method,
          reference: paymentDto.reference,
          note: paymentDto.note,
          paidAt: paymentDto.paidAt ? new Date(paymentDto.paidAt) : undefined,
        },
      });

      const purchaseOrder = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          amountPaid: nextPaid,
          amountDue: nextDue,
          paymentStatus: nextStatus,
        },
        include: {
          supplier: true,
          product: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await this.auditService.log({
        action: 'PURCHASE_ORDER_PAYMENT_ADDED',
        entity: 'PurchaseOrderPayment',
        entityId: purchaseOrderId,
        after: {
          amount: paymentDto.amount,
          amountPaid: nextPaid,
          amountDue: nextDue,
          paymentStatus: nextStatus,
        },
      });

      return purchaseOrder;
    });
  }

  async findPurchaseOrders(page = 1, limit = 20, supplierId?: string) {
    const where = supplierId ? { supplierId } : {};

    const data = await this.prisma.purchaseOrder.findMany({
      skip: (page - 1) * limit,
      take: limit,
      where,
      include: {
        supplier: true,
        product: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.purchaseOrder.count({ where });
    const totalPages = Math.ceil(total / limit);

    return { data, totalPages };
  }
}
