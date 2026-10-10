import { BadRequestException } from '@nestjs/common';
import { calculateWithdrawalBreakdown, WalletService } from './wallet.service';

describe('WalletService withdrawal boundaries', () => {
  it('rejects an amount below the configured threshold before reserving funds', async () => {
    const prisma = { $transaction: jest.fn(), appSetting: { findUnique: jest.fn().mockResolvedValue(null) } };
    const config = { get: jest.fn().mockReturnValue(50000) };
    const wallet = new WalletService(prisma as any, config as any);

    await expect(wallet.requestWithdrawal('user-1', 49999, 'mobile_money', { phone: '+256700000000' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unsupported payout methods', async () => {
    const prisma = { $transaction: jest.fn(), appSetting: { findUnique: jest.fn().mockResolvedValue(null) } };
    const config = { get: jest.fn().mockReturnValue(50000) };
    const wallet = new WalletService(prisma as any, config as any);

    await expect(wallet.requestWithdrawal('user-1', 50000, 'crypto', { address: 'x' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reserves the gross amount and records rounded fees and net payout', async () => {
    const tx = {
      walletAccount: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      withdrawalRequest: { create: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }) },
      walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      appSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const config = { get: jest.fn().mockReturnValue(5000) };
    const wallet = new WalletService(prisma as any, config as any);

    await wallet.requestWithdrawal('user-1', 10_000, 'mobile_money', { phone: '+256700000000' });

    expect(tx.walletAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', balance: { gte: 10_000 } },
      data: { balance: { decrement: 10_000 }, pendingBalance: { increment: 10_000 } },
    });
    expect(tx.withdrawalRequest.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        pendingUserId: 'user-1',
        amount: 10_000,
        transactionFee: 250,
        serviceFee: 150,
        netAmount: 9_600,
        method: 'mobile_money',
        details: { phone: '+256700000000' },
      },
    });
  });

  it('rounds each UGX fee to a whole unit with halves rounded up', () => {
    expect(calculateWithdrawalBreakdown(10_000)).toEqual({
      transactionFee: 250,
      serviceFee: 150,
      netAmount: 9_600,
    });
    expect(calculateWithdrawalBreakdown(20)).toEqual({
      transactionFee: 1,
      serviceFee: 0,
      netAmount: 19,
    });
  });
});
