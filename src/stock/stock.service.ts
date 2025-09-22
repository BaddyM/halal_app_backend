import { Injectable } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StockCategory } from '@prisma/client';
@Injectable()
export class StockService {
    constructor(private prisma: PrismaService) { }

    async create(createStockDto: CreateStockDto, userId: string) {
        const data = await this.prisma.stock.create({
            data: {
                userId: userId,
                item: createStockDto.item,
                qty: createStockDto.qty,
                category: createStockDto.category,
                UnitPrice: createStockDto.unit_price,
                memo: createStockDto.memo,
                subItem: createStockDto.subItem,
            }
        })
        return data;
    }

    async topUpStock(itemId: string, qty: number) {
        const currentQty = await this.prisma.stock.findUnique({
            where: {
                id: itemId,
            },
            select: {
                qty: true,
            }
        });
        if (currentQty?.qty != null) {
            const newQty: number = (currentQty.qty + qty);

            //Update Stock
            await this.prisma.stock.update({
                where: {
                    id: itemId,
                },
                data: {
                    qty: newQty,
                }
            });

            //Add to History
            const data = await this.prisma.stockHistory.create({
                data: {
                    itemId: itemId,
                    qty: qty,
                }
            });
            return data;
        }
        return false;
    }

    async topupHistory(page: number, limit: number) {
        const data = await this.prisma.stockHistory.findMany({
            include: {
                item: {
                    select: {
                        item: true,
                        UnitPrice: true,
                        qty: true,
                    }
                }
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
    }

    async findAll(page: number, limit: number, stockType?: StockCategory) {
        if (stockType != undefined) {
            const data = await this.prisma.stock.findMany({
                take: limit,
                skip: (page - 1) * limit,
                where: {
                    category: stockType,
                },
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                            role: true,
                            isActive: true,
                        }
                    },
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        }
        const data = await this.prisma.stock.findMany({
            take: limit,
            skip: (page - 1) * limit,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        role: true,
                        isActive: true,
                    }
                },
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        return data;
    }

    async stockList() {
        const data = await this.prisma.stock.findMany({
            orderBy: {
                createdAt: "desc"
            }
        });
        return data;
    }

    async findOne(id: string) {
        const data = await this.prisma.stock.findFirst({
            where: {
                id: id,
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        role: true,
                        isActive: true,
                    }
                },
            },
        });
        return data;
    }

    async update(id: string, updateStockDto: UpdateStockDto) {
        const data = await this.prisma.stock.update({
            where: {
                id: id,
            },
            data: updateStockDto,
        })
        return data;
    }

    async remove(id: string) {
        // const data = await this.prisma.stock.delete({
        //     where: {
        //         id: id,
        //     }
        // })
        const data = await this.prisma.stock.update({
            where: {
                id: id,
            },
            data: {
                isDeleted: true,
            }
        })
        return data;
    }
}
