import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveMainBranch(tx: any) {
    const mainBranch = await tx.branch.findFirst({
      where: {
        OR: [{ isMainBranch: true }, { name: 'Main' }],
      },
      select: { id: true, name: true },
    });

    if (!mainBranch) {
      throw new InternalServerErrorException('Main branch not found');
    }

    return mainBranch;
  }

  async create(createProductionDto: CreateProductionDto) {
    const quantity = Number(createProductionDto.quantity);
    if (!createProductionDto.productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new InternalServerErrorException('Product and quantity are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const mainBranch = await this.resolveMainBranch(tx);

      const product = await tx.product.findUnique({
        where: { id: createProductionDto.productId },
        select: { id: true, totalStock: true, price: true },
      });

      if (!product) {
        throw new InternalServerErrorException('Product not found');
      }

      const updatedProduct = await tx.product.update({
        where: { id: createProductionDto.productId },
        data: {
          totalStock: { increment: quantity },
        },
      });

      const mainBranchStock = await tx.branchStock.upsert({
        where: {
          branchId_productId: {
            branchId: mainBranch.id,
            productId: createProductionDto.productId,
          },
        },
        create: {
          branchId: mainBranch.id,
          productId: createProductionDto.productId,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
        },
      });

      const production = await tx.production.create({
        data: {
          productId: createProductionDto.productId,
          branchId: mainBranch.id,
          quantity,
          note: createProductionDto.note || null,
          createdById: createProductionDto.createdById || null,
        },
        include: {
          product: true,
          branch: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        message: 'Production recorded successfully',
        product: updatedProduct,
        mainBranch,
        mainBranchStock,
        production,
      };
    });
  }

  findAll() {
    return this.prisma.production.findMany({
      include: {
        product: true,
        branch: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return `Production record ${id} is not yet persisted`;
  }

  update(id: number, updateProductionDto: UpdateProductionDto) {
    return `Production record ${id} update is not yet persisted`;
  }

  remove(id: number) {
    return `Production record ${id} removal is not yet persisted`;
  }
}
