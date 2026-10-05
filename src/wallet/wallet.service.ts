import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushService } from 'src/push/push.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService = { sendToUser: async () => undefined } as any,
  ) {}

  private async threshold() {
    const saved = await this.prisma.appSetting.findUnique({ where: { key: 'wallet.withdrawalThreshold' } });
    return Math.max(0, Number(saved?.value ?? this.config.get('WITHDRAWAL_THRESHOLD', 50000)));
  }

  async withdrawalSettings() {
    const saved = await this.prisma.appSetting.findUnique({ where: { key: 'wallet.withdrawalThreshold' } });
    const threshold = Number(saved?.value ?? this.config.get('WITHDRAWAL_THRESHOLD', 50000));
    return { minWithdrawal: threshold, withdrawThreshold: threshold, currency: 'UGX' };
  }

  async updateWithdrawalSettings(minWithdrawal: number) {
    if (!Number.isInteger(minWithdrawal) || minWithdrawal < 0) {
      throw new BadRequestException('minWithdrawal must be a non-negative whole number');
    }
    await this.prisma.appSetting.upsert({
      where: { key: 'wallet.withdrawalThreshold' },
      create: { key: 'wallet.withdrawalThreshold', value: minWithdrawal },
      update: { value: minWithdrawal },
    });
    return { minWithdrawal, withdrawThreshold: minWithdrawal, currency: 'UGX' };
  }

  async summary(userId: string) {
    const threshold = await this.threshold();
    const wallet = await this.prisma.walletAccount.upsert({
      where: { userId }, create: { userId }, update: {},
    });
    return {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      lifetime: wallet.lifetime,
      threshold,
      canWithdraw: wallet.balance >= threshold,
      currency: 'UGX',
    };
  }

  transactions(userId: string) {
    return this.prisma.walletTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  withdrawals(userId: string) {
    return this.prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  adminUserLedger(userId: string) {
    return this.prisma.walletTransaction.findMany({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async requestWithdrawal(userId: string, amount: number, method: string, details: Record<string, unknown>) {
    const threshold = await this.threshold();
    if (!Number.isInteger(amount) || amount < threshold) {
      throw new BadRequestException(`Withdrawal minimum is ${threshold} UGX`);
    }
    if (!['mobile_money', 'bank'].includes(method)) throw new BadRequestException('Unsupported withdrawal method');
    const requiredDetail = method === 'mobile_money' ? details?.phone : details?.account;
    if (typeof requiredDetail !== 'string' || !requiredDetail.trim()) {
      throw new BadRequestException(method === 'mobile_money' ? 'A phone number is required' : 'Bank account details are required');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const reserved = await tx.walletAccount.updateMany({
          where: { userId, balance: { gte: amount } },
          data: { balance: { decrement: amount }, pendingBalance: { increment: amount } },
        });
        if (reserved.count !== 1) throw new BadRequestException('Insufficient available balance');
        const request = await tx.withdrawalRequest.create({
          data: { userId, pendingUserId: userId, amount, method, details: details as any },
        });
        await tx.walletTransaction.create({
          data: { userId, type: 'withdrawal_pending', amount: -amount, reference: `withdrawal:${request.id}`, description: 'Withdrawal requested' },
        });
        return request;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new BadRequestException('You already have a pending withdrawal');
      throw error;
    }
  }

  adminList(status?: string, search?: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search ? { user: { OR: [{ name: { contains: search } }, { email: { contains: search } }] } } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async review(id: string, adminId: string, action: 'approve' | 'paid' | 'reject', data: { reference?: string; reason?: string } = {}) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Withdrawal not found');
      if (action === 'approve') {
        if (request.status !== 'pending') throw new BadRequestException('Only pending withdrawals can be approved');
        return tx.withdrawalRequest.update({
          where: { id }, data: { status: 'approved', pendingUserId: null, reviewedBy: adminId, reviewedAt: new Date() },
        });
      }
      if (action === 'paid') {
        if (request.status !== 'approved' || !data.reference?.trim()) {
          throw new BadRequestException('An approved withdrawal and payment reference are required');
        }
        await tx.walletAccount.update({ where: { userId: request.userId }, data: { pendingBalance: { decrement: request.amount } } });
        await tx.walletTransaction.create({ data: { userId: request.userId, type: 'withdrawal_paid', amount: -request.amount, reference: `paid:${request.id}`, description: `Paid: ${data.reference}` } });
        return tx.withdrawalRequest.update({ where: { id }, data: { status: 'paid', reference: data.reference.slice(0, 191), reviewedBy: adminId, reviewedAt: new Date() } });
      }
      if (!['pending', 'approved'].includes(request.status)) throw new BadRequestException('Withdrawal cannot be rejected in its current state');
      await tx.walletAccount.update({
        where: { userId: request.userId },
        data: {
          balance: { increment: request.amount },
          pendingBalance: { decrement: request.amount },
        },
      });
      await tx.walletTransaction.create({ data: { userId: request.userId, type: 'withdrawal_rejected', amount: request.amount, reference: `rejected:${request.id}`, description: data.reason?.slice(0, 255) ?? 'Withdrawal returned to balance' } });
      return tx.withdrawalRequest.update({ where: { id }, data: { status: 'rejected', pendingUserId: null, reason: data.reason?.slice(0, 1000), reviewedBy: adminId, reviewedAt: new Date() } });
    });
    if (action !== 'approve') {
      void this.push.sendToUser(result.userId, {
        title: action === 'paid' ? 'Withdrawal paid' : 'Withdrawal rejected',
        body: action === 'paid'
          ? `Your withdrawal of ${result.amount.toLocaleString()} ${result.currency} was paid.`
          : `Your withdrawal was rejected. ${result.reason ?? 'The amount has been returned to your balance.'}`,
        data: { type: 'withdrawal', withdrawalId: result.id, status: result.status },
      });
    }
    return result;
  }
}