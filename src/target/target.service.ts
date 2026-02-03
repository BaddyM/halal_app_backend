import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateTargetDto, CreateTargetTransactionDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TargetService {
    constructor(
        private readonly prisma: PrismaService
    ) { }
    async create(createTargetDto: CreateTargetDto) {
        try {
            const data = await this.prisma.target.create({
                data: { ...createTargetDto },
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async findAll(page: number, limit: number) {
        try {
            const data = await this.prisma.target.findMany({
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                        }
                    },
                    transactions: true,
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async findByUser(id: string, page: number, limit: number) {
        try {
            const data = await this.prisma.target.findMany({
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                where: {
                    userId: id
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async createTransaction(body: CreateTargetTransactionDto) {
        const previous_total = await this.prisma.targetTransaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                targetId: body.targetId,
            }
        });
        const new_balance = (previous_total?._sum?.amount! + body.amount);
        const data = await this.prisma.targetTransaction.create({
            data: { ...body, balance: new_balance }
        });
        return data;
    }

    async transactions(targetId: string, page: number, limit: number) {
        try {
            const data = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                where: {
                    targetId
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }
    
    async all_transactions(page: number, limit: number) {
        try {
            const data = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async update(id: string, updateTargetDto: UpdateTargetDto) {
        try {
            try {
                const data = await this.prisma.target.update({
                    data: {
                        ...updateTargetDto
                    },
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    },
                    where: {
                        id
                    },
                });
                return data;
            } catch (e) {
                if (process.env.MODE == "Dev") {
                    console.log("error", e);
                }
                throw new InternalServerErrorException({
                    success: false,
                    error: e,
                });
            }
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }
}
