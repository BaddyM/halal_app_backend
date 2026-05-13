import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import {
    CreateStockTransferDto,
    UpsertBranchStockDto,
    CreateBulkStockTransferDto,
} from './dto/branch-stock.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BranchService {
    constructor(private readonly prisma: PrismaService) { }
    async create(createBranchDto: CreateBranchDto) {
        // If this branch is set as main, unset other main branches
        if (createBranchDto.isMainBranch) {
            await this.prisma.branch.updateMany({ where: { isMainBranch: true }, data: { isMainBranch: false } });
        }
        const data = await this.prisma.branch.create({
            data: createBranchDto,
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.branch.findMany({
            skip: (page - 1),
            take: limit,
            orderBy: { createdAt: "desc" }
        });
        const total = await this.prisma.branch.count();
        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
    }

    async update(id: string, updateBranchDto: UpdateBranchDto) {
        // If this update marks the branch as main, clear other mains first
        if ((updateBranchDto as any).isMainBranch) {
            await this.prisma.branch.updateMany({ where: { isMainBranch: true }, data: { isMainBranch: false } });
        }
        const data = await this.prisma.branch.update({
            where: { id },
            data: updateBranchDto
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.branch.update({
            where: { id },
            data: { isActive: true }
        });
        return data;
    }

    //Branch Stock
    async upsert_branch_stock(dto: UpsertBranchStockDto) {
        return this.prisma.branchStock.upsert({
            where: {
                branchId_productId: {
                    branchId: dto.branchId,
                    productId: dto.productId,
                },
            },
            create: {
                branchId: dto.branchId,
                productId: dto.productId,
                quantity: dto.quantity,
            },
            update: { quantity: dto.quantity },
        });
    }

    async list_branch_stock(branchId?: string) {
        return this.prisma.branchStock.findMany({
            where: branchId ? { branchId } : {},
            include: {
                product: true,
                branch: { select: { id: true, name: true } },
            },
            orderBy: [{ branchId: 'asc' }, { productId: 'asc' }],
        });
    }

    //Stock Transfers
    async create_stock_transfer(dto: CreateStockTransferDto) {
        if (dto.fromBranchId === dto.toBranchId) {
            throw new InternalServerErrorException(
                'Source and destination branches must differ',
            );
        }
        const source = await this.prisma.branchStock.findUnique({
            where: {
                branchId_productId: {
                    branchId: dto.fromBranchId,
                    productId: dto.productId,
                },
            },
        });
        if (!source || source.quantity < dto.quantity) {
            throw new InternalServerErrorException(
                'Insufficient stock at source branch',
            );
        }
        const transfer = await this.prisma.stockTransfer.create({
            data: {
                fromBranchId: dto.fromBranchId,
                toBranchId: dto.toBranchId,
                productId: dto.productId,
                quantity: dto.quantity,
                createdById: dto.createdById,
                notes: dto.notes,
            },
        });

        // If this transfer was marked as credit, create a payable record for the receiving branch
        if (dto.onCredit) {
            if (!dto.totalAmount || dto.totalAmount <= 0) {
                throw new BadRequestException('totalAmount is required and must be > 0 when onCredit is true');
            }

            await this.prisma.branchPayable.create({
                data: {
                    branchId: dto.toBranchId,
                    stockTransferId: transfer.id,
                    description: dto.notes || `Payable for transfer ${transfer.id}`,
                    totalAmount: dto.totalAmount,
                    outstanding: dto.totalAmount,
                    createdById: dto.createdById,
                },
            });
        }

        return transfer;
    }

    async create_bulk_stock_transfer(dto: CreateBulkStockTransferDto) {
        if (dto.fromBranchId === dto.toBranchId) {
            throw new InternalServerErrorException(
                'Source and destination branches must differ',
            );
        }

        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException('No items provided for bulk transfer');
        }

        // Validate source stock availability for each item
        let payableTotal = 0;
        for (const item of dto.items) {
            if (!item.quantity || item.quantity <= 0) {
                throw new BadRequestException('Transfer quantity must be greater than zero');
            }
            const source = await this.prisma.branchStock.findUnique({
                where: {
                    branchId_productId: {
                        branchId: dto.fromBranchId,
                        productId: item.productId,
                    },
                },
                include: { product: true }
            });
            if (!source || source.quantity < item.quantity) {
                throw new BadRequestException(
                    `Insufficient stock for product ${item.productId}. Available: ${source?.quantity || 0}`,
                );
            }
            if (dto.onCredit) {
                payableTotal += (source.product.price * item.quantity);
            }
        }

        // Create transfers in a transaction
        return this.prisma.$transaction(async (tx) => {
            const createdTransfers: any[] = [];
            for (const item of dto.items) {
                // Decrement from source
                await tx.branchStock.update({
                    where: {
                        branchId_productId: {
                            branchId: dto.fromBranchId,
                            productId: item.productId,
                        },
                    },
                    data: { quantity: { decrement: item.quantity } },
                });

                // Increment to destination
                await tx.branchStock.upsert({
                    where: {
                        branchId_productId: {
                            branchId: dto.toBranchId,
                            productId: item.productId,
                        },
                    },
                    create: {
                        branchId: dto.toBranchId,
                        productId: item.productId,
                        quantity: item.quantity,
                    },
                    update: { quantity: { increment: item.quantity } },
                });

                const t = await tx.stockTransfer.create({
                    data: {
                        fromBranchId: dto.fromBranchId,
                        toBranchId: dto.toBranchId,
                        productId: item.productId,
                        quantity: item.quantity,
                        createdById: dto.createdById,
                        status: 'COMPLETED',
                        completedAt: new Date(),
                        notes: dto.notes,
                    },
                });
                createdTransfers.push(t);
            }

            let payable: any = null;
            if (dto.onCredit) {
                payable = await tx.branchPayable.create({
                    data: {
                        branchId: dto.toBranchId,
                        // bulk transfer uses no single stockTransferId; keep null
                        description: dto.notes || `Payable for bulk transfer (${createdTransfers.length} items)`,
                        totalAmount: payableTotal,
                        outstanding: payableTotal,
                        createdById: dto.createdById,
                    },
                });
            }

            return { transfers: createdTransfers, payable };
        });
    }

    async complete_stock_transfer(id: string) {
        const transfer = await this.prisma.stockTransfer.findUnique({
            where: { id },
        });
        if (!transfer) {
            throw new InternalServerErrorException('Transfer not found');
        }
        if (transfer.status !== 'PENDING') {
            throw new InternalServerErrorException(
                'Transfer is not pending',
            );
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.branchStock.update({
                where: {
                    branchId_productId: {
                        branchId: transfer.fromBranchId,
                        productId: transfer.productId,
                    },
                },
                data: { quantity: { decrement: transfer.quantity } },
            });
            await tx.branchStock.upsert({
                where: {
                    branchId_productId: {
                        branchId: transfer.toBranchId,
                        productId: transfer.productId,
                    },
                },
                create: {
                    branchId: transfer.toBranchId,
                    productId: transfer.productId,
                    quantity: transfer.quantity,
                },
                update: { quantity: { increment: transfer.quantity } },
            });
            return tx.stockTransfer.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });
        });
    }

    async list_stock_transfers(branchId?: string) {
        return this.prisma.stockTransfer.findMany({
            where: branchId
                ? {
                      OR: [
                          { fromBranchId: branchId },
                          { toBranchId: branchId },
                      ],
                  }
                : {},
            include: {
                fromBranch: { select: { id: true, name: true } },
                toBranch: { select: { id: true, name: true } },
                product: true,
                createdBy: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
