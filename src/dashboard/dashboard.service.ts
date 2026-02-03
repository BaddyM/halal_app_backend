import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) { }

    async summary() {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(24, 0, 0, 0));
        return "dashboard"
    }

    async mobile_summary(userId: string) {
        let balances: any = [];

        const targets = await this.prisma.target.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include:{
                transactions:true,
            }
        });

        for (let i = 0; i < targets.length; i++) {
            balances.push({
                target_label: targets[i].targetLabel,
                amount: targets[i].amount,
                balance: targets[i].transactions.reduce((sum, item) => item.status == "APPROVED" ? sum + item.amount : 0, 0),
            })
        }

        //Recent transactions
        const recent_transactions = await this.prisma.targetTransaction.findMany({
            where: {
                target: {
                    userId
                }
            },
            orderBy: { createdAt: "desc" },
            include: { target: true },
            take: 5,
        });

        //User data
        const user_data = await this.prisma.user.findFirst({
            where: { id: userId },
            select: {
                email: true,
                id: true,
                firstName: true,
                lastName: true,
            }
        })

        return { balances, recent_transactions, user_data };
    }
}
