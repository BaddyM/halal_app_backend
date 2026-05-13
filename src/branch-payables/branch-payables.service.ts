import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Injectable()
export class BranchPayablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, branchId?: string, startDate?: string, endDate?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const data = await this.prisma.branchPayable.findMany({
      where,
      include: { branch: true, deposits: true, stockTransfer: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await this.prisma.branchPayable.count({ where });
    return { data, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const p = await this.prisma.branchPayable.findUnique({
      where: { id },
      include: { branch: true, deposits: { orderBy: { createdAt: 'desc' } }, stockTransfer: true },
    });
    if (!p) throw new NotFoundException('Payable not found');
    return p;
  }

  async createDeposit(payableId: string, dto: CreateDepositDto) {
    const payable = await this.prisma.branchPayable.findUnique({ where: { id: payableId } });
    if (!payable) throw new NotFoundException('Payable not found');

    const deposit = await this.prisma.branchDeposit.create({
      data: {
        payableId,
        branchId: payable.branchId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        recordedById: dto.recordedById,
      },
    });

    const newOutstanding = Math.max(0, payable.outstanding - dto.amount);
    const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await this.prisma.branchPayable.update({
      where: { id: payableId },
      data: { outstanding: newOutstanding, status: newStatus as any },
    });

    return deposit;
  }
}
