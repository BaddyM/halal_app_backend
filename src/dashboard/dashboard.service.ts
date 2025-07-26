import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    async summary() {
        const todayRevenue = await this.prisma.payment.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                createdAt: new Date(),
            }
        });
        const activeOrders = await this.prisma.order.count({
            where: {
                status: "PENDING",
                createdAt: new Date(),
            },
            select: {
                status: true,
            }
        });

        const totalCustomers = await this.prisma.payment.count({
            where: {
                createdAt: new Date(),
            }
        });

        const activeOrdersList = await this.prisma.order.findMany({
            where: {
                status: "PENDING",
                createdAt: new Date(),
            },
            take:10,
        });

        const data = {
            todayRevenue: todayRevenue._sum.amount ?? 0,
            activeOrders: activeOrders.status,
            totalCustomers: totalCustomers ?? 0,
            activeOrdersList:activeOrdersList,
        };
        return data;
    }
}
