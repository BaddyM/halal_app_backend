import { Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExpenseService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createExpenseDto: CreateExpenseDto) {
        let date = new Date().toISOString();

        if (createExpenseDto.date != null && createExpenseDto.date != "") {
            date = new Date(createExpenseDto.date).toISOString()
        }

        delete createExpenseDto.date;

        const data = await this.prisma.expense.create({
            data: {
                ...createExpenseDto,
                createdAt: date,
            },
        });
        return data;
    }

    async findAll(page: number, limit: number, date?: string, branchId?: string) {
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

        if (branchId != null && branchId != undefined && branchId != "undefined" && branchId != "" && branchId != "all") {
            (dateFilter as any).user = {
                branchId
            }
        } else {
            delete (dateFilter as any).user;
        }

        console.log(`branchId: ${branchId}, date:${date}`)
        console.log(dateFilter)

        const data = await this.prisma.expense.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        name: true,
                        branch: true
                    }
                }
            },
            where: {
                ...dateFilter,
            }
        });

        const total = await this.prisma.expense.count({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            where: {
                ...dateFilter,
            }
        });
        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
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
