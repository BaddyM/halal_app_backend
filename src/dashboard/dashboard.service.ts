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
                rep: {
                    select: {
                        branchId: true,
                        branch: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
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

        const supplier_due_outstanding = await this.prisma.purchaseOrder.aggregate({
            _sum: {
                amountDue: true,
            },
            where: {
                amountDue: {
                    gt: 0,
                },
            },
        });

        const total_sales = today_sales.reduce((sum, item) => (sum + (item.quantity * item.unitPrice)), 0);
        const revenue = (total_sales + (total_credit_paid._sum.paid ?? 0));

        const today_expenses = await this.prisma.expense.findMany({
            select: {
                amount: true,
                user: {
                    select: {
                        branchId: true,
                        branch: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        });

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
        const supplier_due_total = supplier_due_outstanding._sum.amountDue ?? 0;
        const supplier_net_revenue = (net_revenue - supplier_spend_total);

        const branch_map = new Map<string, {
            branchId: string;
            branchName: string;
            sales: number;
            expenses: number;
            netRevenue: number;
        }>();

        for (const sale of today_sales) {
            const branchId = sale.rep.branchId || 'unassigned';
            const branchName = sale.rep.branch?.name || 'Unassigned';
            const current = branch_map.get(branchId) ?? {
                branchId,
                branchName,
                sales: 0,
                expenses: 0,
                netRevenue: 0,
            };

            current.sales += sale.quantity * sale.unitPrice;
            branch_map.set(branchId, current);
        }

        for (const exp of today_expenses) {
            const branchId = exp.user?.branchId || 'unassigned';
            const branchName = exp.user?.branch?.name || 'Unassigned';
            const current = branch_map.get(branchId) ?? {
                branchId,
                branchName,
                sales: 0,
                expenses: 0,
                netRevenue: 0,
            };

            current.branchName = branchName;
            current.expenses += exp.amount;
            branch_map.set(branchId, current);
        }

        const branch_summary = Array.from(branch_map.values()).map((entry) => ({
            ...entry,
            netRevenue: entry.sales - entry.expenses,
        })).sort((a, b) => b.netRevenue - a.netRevenue);

        const restock = await this.prisma.product.findMany({
            where: {
                totalStock: {
                    lt: 10
                },
            }
        })

        // Credit sales outstanding (amount on credit not yet completed)
        const credit_outstanding = await this.prisma.creditSale.aggregate({
            _sum: { amount: true },
            where: { status: 'PENDING' },
        });

        // Rep activity today: aggregate stockTakeItem per user
        const takes = await this.prisma.stockTakeItem.findMany({
            where: {
                createdAt: { gte: start, lt: end },
            },
            include: {
                user: { select: { id: true, name: true, branchId: true, branch: { select: { name: true } } } },
            },
        });

        const repMap = new Map<string, { repId: string; repName: string; branchName: string; taken: number; sold: number; returned: number; revenue: number }>();
        for (const t of takes) {
            const key = t.userId || 'unknown';
            const current = repMap.get(key) || { repId: t.userId, repName: t.user?.name || 'Unknown', branchName: t.user?.branch?.name || '—', taken: 0, sold: 0, returned: 0, revenue: 0 };
            current.taken += t.quantityTaken || 0;
            current.sold += t.quantitySold || 0;
            current.returned += t.quantityReturned || 0;
            current.revenue += t.revenue || 0;
            repMap.set(key, current);
        }
        const rep_activity = Array.from(repMap.values());

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
            branch_summary,
            restock,
            credit_sales_outstanding: credit_outstanding._sum.amount ?? 0,
            rep_activity,
        };
    }
}
