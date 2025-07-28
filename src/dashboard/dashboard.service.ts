import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    async summary() {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(24, 0, 0, 0));
        const todayRevenue = await this.prisma.payment.aggregate({
            _sum: {
                paid: true,
            },
            where: {
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            }
        });
        const activeOrders = await this.prisma.order.count({
            where: {
                status: "PENDING",
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            },
            select: {
                status: true,
            }
        });

        const totalCustomers = await this.prisma.payment.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            }
        });

        const activeOrdersList = await this.prisma.order.findMany({
            where: {
                status: "PENDING",
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            },
            take: 10,
        });

        const data = {
            todayRevenue: todayRevenue._sum.paid ?? 0,
            activeOrders: activeOrders.status,
            totalCustomers: totalCustomers ?? 0,
            activeOrdersList: activeOrdersList,
        };
        return data;
    }
}
