import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto, CreateStockTakeDto, StockTakeItemDto, UpdateStockTakeItemDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductService {
    constructor(private readonly prisma: PrismaService) { }

    private async resolveMainBranch(tx: any) {
        const mainBranch = await tx.branch.findFirst({
            where: {
                OR: [{ isMainBranch: true }, { name: 'Main' }],
            },
            select: { id: true },
        });

        if (!mainBranch) {
            throw new InternalServerErrorException('Main branch not found');
        }

        return mainBranch;
    }

    private async syncMainBranchStock(tx: any, productId: string, quantity: number) {
        const mainBranch = await this.resolveMainBranch(tx);

        await tx.branchStock.upsert({
            where: {
                branchId_productId: {
                    branchId: mainBranch.id,
                    productId,
                },
            },
            create: {
                branchId: mainBranch.id,
                productId,
                quantity,
            },
            update: {
                quantity,
            },
        });
    }

    async create(createProductDto: CreateProductDto) {
        return this.prisma.$transaction(async (tx) => {
            const data = await tx.product.create({
                data: createProductDto,
            });

            await this.syncMainBranchStock(tx, data.id, data.totalStock);

            return data;
        });
    }

    async findAll(page: number, limit: number, category?: string) {
        let filter = {}

        if (category != "" && category != undefined && category != "undefined" && category != null && category != "none") {
            (filter as any).category = category;
        }

        const data = await this.prisma.product.findMany({
            skip: (page - 1) * limit,
            take: limit,
            where: {
                ...filter
            },
            orderBy: { createdAt: "desc" },
        });
        const total = await this.prisma.product.count();
        const totalPages = Math.ceil(total / limit);
        return { totalPages, data };
    }

    async low_stock_list() {
        const products = await this.prisma.product.findMany({
            where: {
                reorderLevel: { gt: 0 },
            },
        });
        return products.filter((p) => p.totalStock <= p.reorderLevel);
    }

    async update(id: string, updateProductDto: UpdateProductDto) {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.product.findUnique({
                where: { id },
                select: { totalStock: true },
            });

            const data = await tx.product.update({
                where: { id },
                data: updateProductDto,
            });

            await this.syncMainBranchStock(
                tx,
                id,
                updateProductDto.totalStock ?? current?.totalStock ?? data.totalStock,
            );

            return data;
        });
    }

    async delete(id: string) {
        const data = await this.prisma.product.delete({
            where: { id },
        });
        return data;
    }

    //Stock Take Item
    async create_stock_take_item(stockTake: CreateStockTakeDto) {
        try {
            for (let i = 0; i < stockTake.items.length; i++) {
                const exists = await this.prisma.stockTakeItem.count({
                    where: {
                        userId: stockTake.items[i].userId,
                        productId: stockTake.items[i].productId,
                    }
                });

                //Deduct from stock
                let currentStock = await this.prisma.product.findFirst({
                    where: { id: stockTake.items[i].productId },
                    select: { totalStock: true },
                });

                let newStock = (currentStock!.totalStock - stockTake.items[i].quantityTaken)

                //Update Stock
                await this.prisma.product.update({
                    where: { id: stockTake.items[i].productId },
                    data: { totalStock: newStock },
                });

                if (exists == 0) {
                    const data = await this.prisma.stockTakeItem.create({
                        data: stockTake.items[i],
                    });

                    //Stock take history
                    await this.prisma.stockTakeItemHistory.create({
                        data: {
                            stockTakeItemId: data.id,
                        }
                    });
                } else {
                    await this.prisma.stockTakeItem.updateMany({
                        where: {
                            userId: stockTake.items[i].userId,
                            productId: stockTake.items[i].productId,
                        },
                        data: {
                            quantityTaken: stockTake.items[i].quantityTaken,
                            quantitySold: stockTake.items[i].quantitySold,
                            quantityReturned: stockTake.items[i].quantityReturned,
                            revenue: stockTake.items[i].revenue,
                        },
                    });

                    const data = await this.prisma.stockTakeItem.findMany({
                        where: {
                            userId: stockTake.items[i].userId,
                            productId: stockTake.items[i].productId,
                        },
                    });

                    //Stock take history
                    await this.prisma.stockTakeItemHistory.create({
                        data: {
                            stockTakeItemId: data[0].id,
                        }
                    });
                }
            }
            return { message: "Stock taken successfully" }
        } catch (e) {
            console.log(e)
            throw new InternalServerErrorException({
                message: "Sorry, failed to take stock item",
                error: e,
            })
        }
    }

    async fetch_stock_take_item(page: number, limit: number, userId?: string) {
        let filter = {}

        if (userId != null && userId != undefined && userId != "undefined" && userId != "" && userId != "none") {
            (filter as any).userId = userId;
        }

        const data = await this.prisma.stockTakeItem.findMany({
            skip: (page - 1) * limit,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        branch: {
                            select: {
                                name: true,
                            }
                        }
                    }
                },
                product: true,
            },
            where: {
                ...filter,
            },
            orderBy: { createdAt: "desc" }
        });
        const total = await this.prisma.stockTakeItem.count({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" }
        });
        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
    }

    async fetch_stock_take_item_history(page: number, limit: number) {
        const data = await this.prisma.stockTakeItemHistory.findMany({
            skip: (page - 1) * limit,
            take: limit,
            include: {
                stockTakeItem: {
                    include: {
                        user: {
                            select: {
                                name: true,
                            }
                        },
                        product: true,
                    }
                },
            },
            orderBy: { createdAt: "desc" }
        });
        return data;
    }

    async update_stock_take_item(id: string, updateStockTakeItem: UpdateStockTakeItemDto) {
        const data = await this.prisma.stockTakeItem.update({
            where: { id },
            data: updateStockTakeItem,
        });
        return data;
    }
}
