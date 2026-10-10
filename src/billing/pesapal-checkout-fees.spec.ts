import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { BillingService } from './billing.service';
import { DiscountsService } from './discounts.service';
import { PesapalService } from './pesapal.service';

describe('Pesapal checkout fees', () => {
  const settings = {
    enabled: true,
    currency: 'UGX',
    environment: 'sandbox',
    callbackUrl: 'https://example.test/callback',
    ipnId: 'ipn-1',
  };

  function checkoutService({
    gift = { id: 'gift-1', name: 'Rose', price: 10_000, currency: 'UGX' },
    plan = {
      id: 'plan-1',
      name: 'Premium',
      priceCents: 999,
      currency: 'USD',
    },
  } = {}) {
    const prisma = {
      giftCatalogItem: { findFirst: jest.fn().mockResolvedValue(gift) },
      plan: { findFirst: jest.fn().mockResolvedValue(plan) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          name: 'Amina Noor',
          email: 'amina@example.test',
        }),
      },
      paymentOrder: {
        create: jest.fn().mockResolvedValue({ id: 'order-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const discounts = {
      calculate: jest.fn().mockResolvedValue({
        code: null,
        discountAmount: 0,
        amount: plan.priceCents,
      }),
      reserve: jest.fn(),
      release: jest.fn(),
    };
    const service = new PesapalService(
      prisma as unknown as PrismaService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as BillingService,
      discounts as unknown as DiscountsService,
      {} as any,
      {} as any,
    );
    jest.spyOn(service as any, 'settings').mockResolvedValue(settings);
    jest.spyOn(service as any, 'accessToken').mockResolvedValue('access-token');
    jest
      .spyOn(service as any, 'baseUrl')
      .mockReturnValue('https://pesapal.test');
    return { service, prisma, discounts };
  }

  afterEach(() => jest.restoreAllMocks());

  it('charges and records the gift subtotal plus the rounded 3% fee', async () => {
    const { service, prisma } = checkoutService();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        order_tracking_id: 'tracking-1',
        redirect_url: 'https://pesapal.test/pay',
      }),
    } as Response);

    const result = await service.createGiftCheckout('user-1', 'gift-1', 2);

    expect(prisma.paymentOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemType: 'gift',
        quantity: 2,
        subtotalAmountCents: 20_000,
        feeAmountCents: 600,
        vatAmountCents: 0,
        amountCents: 20_600,
      }),
    });
    const providerOrder = JSON.parse(
      fetchMock.mock.calls[0][1]?.body as string,
    );
    expect(providerOrder.amount).toBe(20_600);
    expect(result).toMatchObject({
      quantity: 2,
      subtotalAmountCents: 20_000,
      feeAmountCents: 600,
      vatAmountCents: 0,
      amountCents: 20_600,
    });
  });

  it('charges a subscription fee on the discounted amount in minor units', async () => {
    const { service, prisma, discounts } = checkoutService();
    discounts.calculate.mockResolvedValue({
      code: { id: 'discount-1' },
      discountAmount: 100,
      amount: 899,
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        order_tracking_id: 'tracking-2',
        redirect_url: 'https://pesapal.test/pay',
      }),
    } as Response);

    await service.createSubscriptionCheckout('user-1', 'plan-1', 'SAVE');

    expect(prisma.paymentOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemType: 'subscription',
        subtotalAmountCents: 999,
        discountAmountCents: 100,
        feeAmountCents: 27,
        vatAmountCents: 0,
        amountCents: 926,
      }),
    });
    expect(discounts.reserve).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      'discount-1',
    );
    const providerOrder = JSON.parse(
      fetchMock.mock.calls[0][1]?.body as string,
    );
    expect(providerOrder.amount).toBe(9.26);
  });

  it('does not fulfil an order when Pesapal reports a different total or currency', async () => {
    const order = {
      id: 'order-3',
      userId: 'user-1',
      itemType: 'subscription',
      itemId: 'plan-1',
      amountCents: 1_029,
      currency: 'USD',
      status: 'pending',
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const billing = { activateVerifiedPesapalPlan: jest.fn() };
    const discounts = { release: jest.fn().mockResolvedValue(undefined) };
    const service = new PesapalService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      billing as unknown as BillingService,
      discounts as unknown as DiscountsService,
      {} as any,
      {} as any,
    );
    jest.spyOn(service as any, 'providerStatus').mockResolvedValue({
      status: 'COMPLETED',
      amount: 9.99,
      currency: 'USD',
    });

    await expect(service.refreshOrder('user-1', 'tracking-3')).resolves.toEqual(
      {
        status: 'failed',
      },
    );
    expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-3', status: 'pending' },
      data: { status: 'failed', providerStatus: 'AMOUNT_MISMATCH' },
    });
    expect(billing.activateVerifiedPesapalPlan).not.toHaveBeenCalled();
    expect(discounts.release).toHaveBeenCalledWith('order-3');
  });

  it('activates a subscription with the verified total including its fee', async () => {
    const order: any = {
      id: 'order-4',
      userId: 'user-1',
      itemType: 'subscription',
      itemId: 'plan-1',
      quantity: 1,
      amountCents: 1_029,
      subtotalAmountCents: 999,
      discountAmountCents: 0,
      currency: 'USD',
      merchantReference: 'merchant-4',
      orderTrackingId: 'tracking-4',
      status: 'pending',
    };
    const updateOrder = jest.fn(async ({ data }: any) => {
      Object.assign(order, data);
      return order;
    });
    const paymentOrder = {
      findUnique: jest.fn().mockResolvedValue(order),
      updateMany: jest.fn(async ({ data }: any) => {
        Object.assign(order, data);
        return { count: 1 };
      }),
      update: updateOrder,
    };
    const prisma = {
      paymentOrder,
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          name: 'Amina Noor',
          email: 'amina@example.test',
        }),
      },
      plan: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Premium',
          interval: 'month',
        }),
      },
      $transaction: jest.fn((work: (tx: any) => Promise<unknown>) =>
        work({ paymentOrder: { update: updateOrder } }),
      ),
    };
    const billing = { activateVerifiedPesapalPlan: jest.fn() };
    const discounts = {
      redeem: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const mail = {
      formatPaymentAmount: jest.fn().mockReturnValue('$10.29'),
      sendPaymentReceipt: jest.fn().mockResolvedValue(undefined),
    };
    const realtime = { emitAdminEvent: jest.fn() };
    const service = new PesapalService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      billing as unknown as BillingService,
      discounts as unknown as DiscountsService,
      realtime as any,
      mail as any,
    );
    jest.spyOn(service as any, 'providerStatus').mockResolvedValue({
      status: 'COMPLETED',
      amount: 10.29,
      currency: 'USD',
    });

    await expect(service.refreshOrder('user-1', 'tracking-4')).resolves.toEqual(
      {
        status: 'completed',
      },
    );
    expect(billing.activateVerifiedPesapalPlan).toHaveBeenCalledWith(
      'user-1',
      'plan-1',
      'tracking-4',
      1_029,
    );
    expect(order.status).toBe('completed');
  });
});
