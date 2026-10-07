import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { MailService } from 'src/mail/mail.service';

describe('BillingService payment receipts', () => {
  function serviceWith(receiptResult: Promise<unknown> = Promise.resolve({})) {
    const plan = {
      id: 'premium-plan',
      name: 'Premium',
      tier: 'premium',
      priceCents: 999,
      currency: 'USD',
      interval: 'month',
    };
    const createdAt = new Date('2026-10-07T12:00:00.000Z');
    const prisma = {
      plan: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(plan),
      },
      subscription: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          provider: 'stripe',
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          plan,
        }),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'member-1',
          name: 'Amina',
          email: 'amina@example.com',
          plan: 'premium',
          planExpiresAt: null,
          likesUsedToday: 0,
          activeChatsCount: 0,
        }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'txn-1', createdAt }),
      },
    };
    const mail = {
      formatPaymentAmount: jest.fn().mockReturnValue('$9.99'),
      sendPaymentReceipt: jest.fn().mockReturnValue(receiptResult),
    };
    const realtime = {
      emitToUser: jest.fn(),
      emitAdminEvent: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue('Prod'),
    };
    const service = new BillingService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      realtime as unknown as RealtimeBus,
      mail as unknown as MailService,
    );

    return { service, prisma, mail };
  }

  it('emails a receipt after a paid subscription is activated', async () => {
    const { service, mail } = serviceWith();

    await service.activatePlan(
      'member-1',
      'premium-plan',
      'stripe',
      'session-1',
    );

    expect(mail.sendPaymentReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'amina@example.com',
        customerName: 'Amina',
        itemName: 'Premium subscription (monthly)',
        amount: '$9.99',
        provider: 'stripe',
        reference: 'session-1',
      }),
    );
  });

  it('does not send a duplicate receipt for an already-recorded payment', async () => {
    const { service, prisma, mail } = serviceWith();
    prisma.transaction.findFirst.mockResolvedValue({ id: 'existing-txn' });

    await service.activatePlan(
      'member-1',
      'premium-plan',
      'stripe',
      'session-1',
    );

    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(mail.sendPaymentReceipt).not.toHaveBeenCalled();
  });

  it('keeps an activated payment successful when email delivery fails', async () => {
    const { service, mail } = serviceWith(
      Promise.reject(new Error('SMTP unavailable')),
    );

    await expect(
      service.activatePlan('member-1', 'premium-plan', 'stripe', 'session-1'),
    ).resolves.toBeDefined();
    expect(mail.sendPaymentReceipt).toHaveBeenCalledTimes(1);
  });
});
