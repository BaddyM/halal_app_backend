import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async summary() {
        const start = new Date();
        start.setHours(0, 0, 0, 0); //Midnight

        const end = new Date(start);
        end.setDate(end.getDate() + 1); //Tomorrow midnight

        const total_stock = await this.prisma.product.aggregate({
            _sum: {
                totalStock: true,
            },
        });

        const stock_out = await this.prisma.stockTakeItem.aggregate({
            _sum: {
                quantityTaken: true
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end
                }
            }
        });

        const stock_returned = await this.prisma.stockTakeItem.aggregate({
            _sum: {
                quantityReturned: true
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end
                }
            }
        });

        const sold = await this.prisma.sale.count({
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                }
            }
        });

        const today_sales = await this.prisma.sale.findMany({
            select: {
                quantity: true,
                unitPrice: true,
                onCredit: false,
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        });

        const total_credit_paid = await this.prisma.creditPayment.aggregate({
            _sum: {
                paid: true,
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        })

        const supplier_spend = await this.prisma.purchaseOrder.aggregate({
            _sum: {
                totalPrice: true,
                amountDue: true,
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        });

        const total_sales = today_sales.reduce((sum, item) => (sum + (item.quantity * item.unitPrice)), 0);
        const revenue = (total_sales + (total_credit_paid._sum.paid ?? 0));

        const expense = await this.prisma.expense.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        });

        const net_revenue = (revenue - (expense._sum.amount ?? 0));
        const supplier_spend_total = supplier_spend._sum.totalPrice ?? 0;
        const supplier_due_total = supplier_spend._sum.amountDue ?? 0;
        const supplier_net_revenue = (net_revenue - supplier_spend_total);

        const restock = await this.prisma.product.findMany({
            where: {
                totalStock: {
                    lt: 10
                },
            }
        })

        return {
            total_stock: total_stock._sum.totalStock ?? 0,
            stock_out: stock_out._sum.quantityTaken ?? 0,
            sold: sold ?? 0,
            stock_returned: stock_returned._sum.quantityReturned ?? 0,
            revenue,
            expense: expense._sum.amount ?? 0,
            supplier_spend: supplier_spend_total,
            supplier_due: supplier_due_total,
            net_revenue,
            supplier_net_revenue,
            restock,
        };
    }
}
