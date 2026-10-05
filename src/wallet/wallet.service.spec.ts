import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';

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
});
