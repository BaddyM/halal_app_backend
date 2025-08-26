import { Injectable } from '@nestjs/common';
import { CreateBankingDto } from './dto/create-banking.dto';
import { UpdateBankingDto } from './dto/update-banking.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BankingService {
    constructor(private prisma: PrismaService) { }
    async create(createBankingDto: CreateBankingDto) {
        const data = await this.prisma.banking.create({
            data: {
                ...createBankingDto
            }
        })
        return data;
    }

    async findAll(page: number, limit: number, date: string) {
        const start = new Date(date);
        if (isNaN(start.getTime())) throw new Error("Invalid 'from' date");
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const data = await this.prisma.banking.findMany({
            take: limit,
            skip: (page - 1) * limit,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        isActive: true,
                    }
                }
            },
            where: {
                createdAt: { gte: start, lt: end },
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        return data;
    }

    async update(id: string, updateBankingDto: UpdateBankingDto) {
        const data = await this.prisma.banking.update({
            where: {
                id: id,
            },
            data: {
                ...updateBankingDto
            }
        })
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.banking.delete({
            where: {
                id: id,
            },
        })
        return data;
    }
}
