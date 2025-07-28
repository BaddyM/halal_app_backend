import { Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExpenseService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createExpenseDto: CreateExpenseDto) {
        const data = await this.prisma.expense.create({
            data: {
                userId: userId,
                ...createExpenseDto,
            }
        });
        return data;
    }

    async findAll(page: number, limit: number, from: string, to: string) {
        if (from != undefined && to != undefined) {
            const data = await this.prisma.expense.findMany({
                take: limit,
                skip: (page - 1) * limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                            role: true,
                        }
                    }
                },
                where: {
                    createdAt: {
                        gte: new Date(from),
                        lte: new Date(to),
                    }
                }
            });
            return data;
        }
        const data = await this.prisma.expense.findMany({
            take: limit,
            skip: (page - 1) * limit,
            orderBy: {
                createdAt: "desc",
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        role: true,
                    }
                }
            }
        });
        return data;
    }

    async update(id: string, updateExpenseDto: UpdateExpenseDto) {
        const data = await this.prisma.expense.update({
            where: {
                id: id,
            },
            data: updateExpenseDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.expense.delete({
            where: {
                id: id,
            }
        });
        return data;
    }
}
