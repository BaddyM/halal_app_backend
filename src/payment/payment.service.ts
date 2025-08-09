import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PaymentService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createPaymentDto: CreatePaymentDto) {
        const data = await this.prisma.payment.create({
            data: {
                userId: userId,
                ...createPaymentDto,
            }
        })
        return data;
    }

    async findAll(page: number, limit: number, from?: string, to?: string, userId?: string) {
        if (from != undefined && to != undefined) {
            const data = await this.prisma.payment.findMany({
                skip: (page - 1) * limit,
                take: limit,
                where: {
                    createdAt: {
                        gte: new Date(from),
                        lte: new Date(to),
                    }
                },
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    order: {
                        include: {
                            item: true,
                        }
                    },
                    user: {
                        select: {
                            name: true,
                            email: true,
                        }
                    },
                    service: true,
                }
            });
            return data;
        } else if (userId != undefined && userId != "undefined") {
            const data = await this.prisma.payment.findMany({
                skip: (page - 1) * limit,
                take: limit,
                where: {
                    userId: userId,
                },
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    order: {
                        include: {
                            item: true,
                        }
                    },
                    user: {
                        select: {
                            name: true,
                            email: true,
                        }
                    },
                    service: true,
                }
            });
            return data;
        }
        const data = await this.prisma.payment.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                createdAt: "desc"
            },
            include: {
                order: {
                    include: {
                        item: true,
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                },
                service: true,
            }
        });
        return data;
    }

    async update(id: string, updatePaymentDto: UpdatePaymentDto) {
        const data = await this.prisma.payment.update({
            where: {
                id: id,
            },
            data: updatePaymentDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.payment.delete({
            where: {
                id: id,
            },
        });
        return data;
    }
}
