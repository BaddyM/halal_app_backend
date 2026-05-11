import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import {
  CreateStockTransferDto,
  UpsertBranchStockDto,
} from './dto/branch-stock.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BranchService {
    constructor(private readonly prisma: PrismaService) { }
    async create(createBranchDto: CreateBranchDto) {
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
        return this.prisma.stockTransfer.create({
            data: {
                fromBranchId: dto.fromBranchId,
                toBranchId: dto.toBranchId,
                productId: dto.productId,
                quantity: dto.quantity,
                createdById: dto.createdById,
                notes: dto.notes,
            },
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
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
