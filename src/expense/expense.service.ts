import { Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExpenseService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createExpenseDto: CreateExpenseDto) {
        const data = await this.prisma.expense.create({
            data: createExpenseDto,
        });
        return data;
    }

    async findAll(page: number, limit: number, date?: string) {
        let dateFilter = {}

        if (date != null && date != undefined && date != "undefined" && date != "") {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            (dateFilter as any).createdAt = {
                gte: start,
                lt: end
            };
        }

        const data = await this.prisma.expense.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            where: {
                ...dateFilter
            }
        });
        return data;
    }

    async update(id: string, updateExpenseDto: UpdateExpenseDto) {
        const data = await this.prisma.expense.update({
            where: { id },
            data: updateExpenseDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.expense.delete({
            where: { id },
        });
        return data;
    }
}
