import { Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ServicesService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createServiceDto: CreateServiceDto) {
        const data = await this.prisma.service.create({
            data: {
                userId: userId,
                customer: createServiceDto.customer,
                phoneNumber: createServiceDto.phoneNumber,
                service: createServiceDto.service,
                memo: createServiceDto.memo,
                duration: createServiceDto.duration,
                amount: createServiceDto.amount,
            }
        });
        return data;
    }

    async findAll(page: number, limit: number, date: string) {
        const start = new Date(date);
        if (isNaN(start.getTime())) throw new Error("Invalid 'from' date");
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const data = await this.prisma.service.findMany({
            take: limit,
            skip: (page - 1) * limit,
            orderBy: {
                createdAt: "desc",
            },
            include: {
                Payment: {
                    select: {
                        paid: true,
                    }
                }
            },
            where: {
                createdAt: { gte: start, lt: end },
            }
        });
        return data;
    }

    async findOne(id: string) {
        const data = await this.prisma.service.findUnique({
            where: {
                id: id,
            }
        });
        return data;
    }

    async update(id: string, updateServiceDto: UpdateServiceDto) {
        const data = await this.prisma.service.update({
            where: {
                id: id,
            },
            data: updateServiceDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.service.delete({
            where: {
                id: id,
            },
        });
        return data;
    }
}
