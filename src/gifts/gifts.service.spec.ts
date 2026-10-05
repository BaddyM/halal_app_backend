import { BadRequestException } from '@nestjs/common';
import { GiftsService } from './gifts.service';

describe('GiftsService', () => {
  const gift = { id: 'gift-1', name: 'Rose', cashValue: 10, currency: 'UGX' };
  const tx = {
    giftInventory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    giftSent: { create: jest.fn().mockResolvedValue({ id: 'sent-1' }) },
    walletAccount: { upsert: jest.fn().mockResolvedValue({}) },
    walletTransaction: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    giftCatalogItem: { findFirst: jest.fn().mockResolvedValue(gift) },
    match: { findFirst: jest.fn().mockResolvedValue({ id: 'match-1' }) },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 'sender-1' ? { name: 'Sender' } : { id: 'recipient-1' })),
    },
    $transaction: jest.fn((work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const service = new GiftsService(prisma as any, {} as any, push as any);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.giftInventory.updateMany.mockResolvedValue({ count: 1 });
    tx.giftSent.create.mockResolvedValue({ id: 'sent-1' });
  });

  it('deducts and credits the requested quantity atomically', async () => {
    await service.send('sender-1', 'gift-1', 'recipient-1', 3, 'Salaam');

    expect(tx.giftInventory.updateMany).toHaveBeenCalledWith({
      where: { userId: 'sender-1', giftId: 'gift-1', quantity: { gte: 3 } },
      data: { quantity: { decrement: 3 } },
    });
    expect(tx.giftSent.create).toHaveBeenCalledWith({
      data: {
        giftId: 'gift-1',
        senderId: 'sender-1',
        recipientId: 'recipient-1',
        quantity: 3,
        message: 'Salaam',
        cashValue: 30,
      },
    });
    expect(tx.walletAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { userId: 'recipient-1', balance: 30, lifetime: 30 },
      update: { balance: { increment: 30 }, lifetime: { increment: 30 } },
    }));
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 30 }),
    }));
    expect(push.sendToUser).toHaveBeenCalledWith('recipient-1', expect.objectContaining({
      title: 'Congratulations!',
      data: expect.objectContaining({ type: 'gift_received', giftSentId: 'sent-1', quantity: 3 }),
    }));
  });

  it('rejects quantities outside the supported range', async () => {
    await expect(service.send('sender-1', 'gift-1', 'recipient-1', 21))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.giftCatalogItem.findFirst).not.toHaveBeenCalled();
  });
});