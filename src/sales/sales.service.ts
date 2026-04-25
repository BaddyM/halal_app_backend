import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  CreateMultipleSaleDto,
  CreditSaleDto,
  CreditSalePaymentDto,
  UpdateCreditSaleDto,
  UpdateCreditSalePaymentDto,
} from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 } from 'uuid';

type SaleRecord = {
  id: string;
  orderId: string;
  repId: string;
  stockTakeId: string | null;
  productId: string | null;
  itemName: string;
  itemType: 'PRODUCT' | 'CUSTOM';
  quantity: number;
  customerId: string | null;
  unitPrice: number;
  memo: string | null;
  onCredit: boolean;
  createdAt: Date;
  rep: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  customer: {
    id: string;
    name: string;
  } | null;
  product: {
    id: string;
  } | null;
};

type SaleLineItem = {
  id: string;
  productId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isCustomItem: boolean;
  product: SaleRecord['product'];
};

type SaleGroup = {
  orderId: string;
  user: SaleRecord['rep'];
  product: SaleRecord['product'];
  customer: SaleRecord['customer'];
  memo: string | null;
  onCredit: boolean;
  createdAt: Date;
  total: number;
  totalQuantity: number;
  itemSummary: string[];
  items: SaleLineItem[];
};

type CreatedSale = {
  orderId: string;
  repId: string;
  quantity: number;
  unitPrice: number;
  onCredit: boolean;
};

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildProductItemName(product: {
    category: string;
    classLevel?: string | null;
    subject?: string | null;
  }) {
    const parts = [String(product.category).replace(/_/g, ' ')];
    if (product.classLevel) {
      parts.push(product.classLevel);
    }
    if (product.subject) {
      parts.push(product.subject);
    }
    return parts.join(' - ');
  }

  private groupSalesByOrder(records: SaleRecord[]) {
    const grouped: Record<string, SaleGroup> = {};

    for (const item of records) {
      if (!grouped[item.orderId]) {
        grouped[item.orderId] = {
          orderId: item.orderId,
          user: item.rep,
          product: item.product,
          customer: item.customer,
          memo: item.memo,
          onCredit: item.onCredit,
          createdAt: item.createdAt,
          total: 0,
          totalQuantity: 0,
          itemSummary: [],
          items: [],
        };
      }

      const group = grouped[item.orderId];
      group.total += item.unitPrice * item.quantity;
      group.totalQuantity += item.quantity;
      group.itemSummary.push(item.itemName);
      group.items.push({
        id: item.id,
        productId: item.productId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        isCustomItem: item.itemType === 'CUSTOM',
        product: item.product,
      });
    }

    return Object.values(grouped).map((entry) => ({
      ...entry,
      itemSummary: [...new Set(entry.itemSummary)].join(', '),
    }));
  }

  async create(createSaleDto: CreateMultipleSaleDto) {
    try {
      const data: CreatedSale[] = [];
      const orderId = v4();
      const rep = await this.prisma.user.findUnique({
        where: { id: createSaleDto.items[0]?.repId },
        select: { id: true, role: true },
      });

      if (!rep) {
        throw new InternalServerErrorException('Sales rep was not found');
      }

      for (let i = 0; i < createSaleDto.items.length; i++) {
        const saleItem = createSaleDto.items[i];
        const isCustomItem = !saleItem.productId;

        if (isCustomItem && rep.role === 'sales_rep') {
          throw new InternalServerErrorException(
            'Sales reps can only sell assigned products',
          );
        }

        let itemName = saleItem.itemName?.trim();
        let productRecord: {
          id: string;
          totalStock: number;
          category: string;
          classLevel?: string | null;
          subject?: string | null;
        } | null = null;

        if (!isCustomItem) {
          productRecord = await this.prisma.product.findUnique({
            where: { id: saleItem.productId },
            select: {
              id: true,
              totalStock: true,
              category: true,
              classLevel: true,
              subject: true,
            },
          });

          if (!productRecord) {
            throw new InternalServerErrorException(
              `Product ${saleItem.productId} was not found`,
            );
          }

          if (!itemName) {
            itemName = this.buildProductItemName(productRecord);
          }

          if (saleItem.quantity > productRecord.totalStock) {
            throw new InternalServerErrorException(
              `Insufficient stock for ${itemName}`,
            );
          }

          if (rep.role === 'sales_rep') {
            const current_stock_item =
              await this.prisma.stockTakeItem.findFirst({
                where: {
                  userId: saleItem.repId,
                  productId: saleItem.productId,
                },
              });

            if (!current_stock_item) {
              throw new InternalServerErrorException(
                'This product is not assigned to the sales rep',
              );
            }

            const remaining =
              (current_stock_item.quantityTaken ?? 0) -
              (current_stock_item.quantitySold ?? 0) -
              (current_stock_item.quantityReturned ?? 0);

            if (saleItem.quantity > remaining) {
              throw new InternalServerErrorException(
                `Cannot sell more than the assigned stock for ${itemName}`,
              );
            }
          }
        }

        if (!itemName) {
          throw new InternalServerErrorException(
            'Sale item name is required for custom items',
          );
        }

        if (productRecord) {
          await this.prisma.product.update({
            where: { id: productRecord.id },
            data: { totalStock: productRecord.totalStock - saleItem.quantity },
          });
        }

        //Add Sales
        const salePayload: Record<string, unknown> = {
          repId: saleItem.repId,
          stockTakeId: saleItem.stockTakeId,
          productId: saleItem.productId ?? undefined,
          itemName,
          itemType: isCustomItem ? 'CUSTOM' : 'PRODUCT',
          quantity: saleItem.quantity,
          customerId: saleItem.customerId,
          unitPrice: saleItem.unitPrice,
          memo: saleItem.memo,
          onCredit: saleItem.onCredit ?? false,
          orderId,
        };

        const sale_data = (await this.prisma.sale.create({
          data: salePayload as never,
        })) as unknown as CreatedSale;

        //Deduct from sales rep.
        if (rep.role === 'sales_rep' && saleItem.productId) {
          const current_stock_item = await this.prisma.stockTakeItem.findFirst({
            where: {
              userId: rep.id,
              productId: saleItem.productId,
            },
          });

          if (!current_stock_item) {
            throw new InternalServerErrorException(
              'This product is not assigned to the sales rep',
            );
          }

          const new_stock_taken: number =
            (current_stock_item.quantitySold ?? 0) + saleItem.quantity;

          await this.prisma.stockTakeItem.update({
            where: {
              id: current_stock_item.id,
            },
            data: {
              quantitySold: new_stock_taken,
            },
          });
        }

        data.push(sale_data);
      }

      //Create a sale on credit
      if (createSaleDto.items[0].onCredit) {
        const amount = data.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
        const creditSale: CreditSaleDto = {
          orderId: data[0].orderId,
          amount,
          userId: data[0].repId,
        };
        await this.create_credit_sale(creditSale);
      }

      return data;
    } catch (error: unknown) {
      console.error('Error creating sale:', error);
      throw new InternalServerErrorException({
        message: 'Sorry, failed to create sale',
        error,
      });
    }
  }

  async findAll(
    page: number,
    limit: number,
    date?: string,
    productId?: string,
  ) {
    const dateFilter: Record<string, unknown> = {};

    if (
      date != null &&
      date != undefined &&
      date != 'undefined' &&
      date != ''
    ) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      dateFilter.createdAt = {
        gte: start,
        lt: end,
      };
    }

    if (
      productId != null &&
      productId != '' &&
      productId != 'undefined' &&
      productId != undefined
    ) {
      dateFilter.productId = productId;
    }

    const records = (await this.prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rep: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        customer: true,
        product: true,
      },
      where: {
        ...dateFilter,
      },
      take: limit,
      skip: (page - 1) * limit,
    })) as unknown as SaleRecord[];

    return this.groupSalesByOrder(records);
  }

  async findOne(orderId: string) {
    const data = await this.prisma.sale.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return data;
  }

  async update(id: string, updateSaleDto: UpdateSaleDto) {
    const data = await this.prisma.sale.update({
      where: { id },
      data: updateSaleDto,
    });
    return data;
  }

  //Credit sales
  async create_credit_sale(creditSateDto: CreditSaleDto) {
    const data = await this.prisma.creditSale.create({
      data: creditSateDto,
    });
    return data;
  }

  async fetch_credit_sale(page: number, limit: number) {
    const data = await this.prisma.creditSale.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creditPayments: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    return data;
  }

  async update_credit_sale(
    id: string,
    updateCreditSalesDto: UpdateCreditSaleDto,
  ) {
    const data = await this.prisma.creditSale.update({
      where: { id },
      data: updateCreditSalesDto,
    });
    return data;
  }

  //Credit sale payments
  async create_credit_payment(creditSalePaymentDto: CreditSalePaymentDto) {
    //Get current orderId
    const creditSales = await this.prisma.creditSale.findMany({
      where: {
        orderId: creditSalePaymentDto.orderId,
        status: 'PENDING',
      },
    });

    if (creditSales.length > 0) {
      const sales_data = await this.prisma.sale.findMany({
        where: { orderId: creditSalePaymentDto.orderId },
        select: { unitPrice: true, quantity: true },
      });

      //Fetch current paid
      let paid: number = 0;
      let total_amount: number = 0;

      for (let x = 0; x < sales_data.length; x++) {
        total_amount =
          total_amount + sales_data[x].unitPrice * sales_data[x].quantity;
      }

      for (let i = 0; i < creditSales.length; i++) {
        const paid_data = await this.prisma.creditSale.findFirst({
          where: { id: creditSales[i].id },
          select: {
            creditPayments: true,
          },
        });

        if (paid_data != null) {
          if (paid_data?.creditPayments.length > 0) {
            for (let k = 0; k < paid_data?.creditPayments.length; k++) {
              paid = paid + paid_data?.creditPayments[k].paid;
            }
          }
        }
      }

      //Fetch current balance
      const balance: number = total_amount - paid;
      const newPaid: number = paid + creditSalePaymentDto.paid;

      //Save
      if (balance >= 0 && newPaid <= total_amount) {
        const creditSaleId = await this.prisma.creditSale.findFirst({
          where: { orderId: creditSalePaymentDto.orderId, status: 'PENDING' },
          select: { id: true },
        });

        if (creditSaleId != null) {
          const data = await this.prisma.creditPayment.create({
            data: {
              creditSaleId: creditSaleId.id,
              paid: creditSalePaymentDto.paid,
              userId: creditSalePaymentDto.userId,
            },
          });

          if (newPaid == total_amount) {
            await this.prisma.creditSale.updateMany({
              where: { orderId: creditSalePaymentDto.orderId },
              data: { status: 'COMPLETED' },
            });
          }
          return data;
        } else {
          return {
            message:
              'Sorry, credit sale id cannot be null.\nPlease try again later.',
          };
        }
      } else {
        throw new InternalServerErrorException(
          `UGX ${creditSalePaymentDto.paid} paid is high, kindly reduce the amount being paid to UGX ${balance} inorder to complete the transaction.`,
        );
      }
    } else {
      throw new InternalServerErrorException(
        'This transaction was completed or is unavailable',
      );
    }
  }

  async fetch_credit_payment(page: number, limit: number) {
    const data = await this.prisma.creditPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creditSale: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    return data;
  }

  async update_credit_payment(
    id: string,
    updateCreditPaymentDto: UpdateCreditSalePaymentDto,
  ) {
    const data = await this.prisma.creditPayment.update({
      where: { id },
      data: updateCreditPaymentDto,
    });
    return data;
  }
}
