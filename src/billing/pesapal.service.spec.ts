import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { DiscountsService } from './discounts.service';
import { PesapalService } from './pesapal.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

describe('PesapalService admin configuration', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');

  function serviceWith(
    initialSetting: { key: string; value: unknown } | null = null,
  ) {
    let setting = initialSetting;
    const paymentOrder = {
      findUnique: jest.fn(async () => ({ merchantReference: 'merchant-ref' })),
    };
    const prisma = {
      appSetting: {
        findUnique: jest.fn(async () => setting),
        upsert: jest.fn(
          async ({ create }: { create: { key: string; value: unknown } }) => {
            setting = create;
            return setting;
          },
        ),
      },
      paymentOrder,
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'PAYMENT_KEYS_ENCRYPTION_KEY' ? encryptionKey : undefined,
      ),
    };
    const service = new PesapalService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      {} as BillingService,
      {} as DiscountsService,
      {} as RealtimeBus,
    );
    return { service, prisma, paymentOrder };
  }

  it('persists and reloads the enabled live-payment state', async () => {
    const { service, prisma } = serviceWith();

    await service.saveSettings({
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      environment: 'live',
      callbackUrl: 'https://example.test/payments/return',
      ipnId: 'ipn-123',
      enabled: true,
      currency: 'UGX',
    });

    await expect(service.adminSettings()).resolves.toMatchObject({
      configured: true,
      environment: 'live',
      enabled: true,
      hasCredentials: true,
      ipnId: 'ipn-123',
    });
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(prisma.appSetting.upsert.mock.calls[0][0]),
    ).not.toContain('consumer-secret');
  });

  it('keeps payments enabled through later saves until explicitly disabled', async () => {
    const { service } = serviceWith();
    const settings = {
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      environment: 'live' as const,
      callbackUrl: 'https://example.test/payments/return',
      ipnId: 'ipn-123',
    };

    await service.saveSettings({ ...settings, enabled: true });
    await service.saveSettings({ currency: 'KES' });
    await expect(service.adminSettings()).resolves.toMatchObject({
      enabled: true,
      currency: 'KES',
    });

    await service.saveSettings({ enabled: false });
    await expect(service.adminSettings()).resolves.toMatchObject({
      enabled: false,
      currency: 'KES',
    });
  });

  it('tests credentials entered in the current admin form without saving them first', async () => {
    const { service } = serviceWith();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token' }),
    } as Response);

    await expect(
      service.testConnection({
        consumerKey: 'unsaved-key',
        consumerSecret: 'unsaved-secret',
        environment: 'live',
      }),
    ).resolves.toEqual({ ok: true, provider: 'pesapal' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pay.pesapal.com/v3/api/Auth/RequestToken',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          consumer_key: 'unsaved-key',
          consumer_secret: 'unsaved-secret',
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it('allows saving credentials before an IPN ID exists, but not enabling payments', async () => {
    const { service } = serviceWith();
    const settings = {
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      environment: 'sandbox' as const,
      callbackUrl: 'https://example.test/payments/return',
      enabled: false,
    };

    await service.saveSettings(settings);
    await expect(service.adminSettings()).resolves.toMatchObject({
      configured: true,
      hasCredentials: true,
      ipnId: null,
      enabled: false,
    });
    await expect(
      service.saveSettings({ enabled: true }),
    ).rejects.toThrow('Register the Pesapal IPN listener');
  });

  it('registers the app listener with Pesapal and persists the returned ID', async () => {
    const { service } = serviceWith();
    await service.saveSettings({
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      environment: 'sandbox',
      callbackUrl: 'https://example.test/payments/return',
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ipn_id: 'registered-ipn-id' }),
      } as Response);

    await expect(service.registerIpn()).resolves.toMatchObject({
      ipnId: 'registered-ipn-id',
      ipnListenerUrl:
        'https://admin.halalconnect.space/api/public/payments/pesapal/ipn',
      notificationType: 'GET',
    });
    await expect(service.adminSettings()).resolves.toMatchObject({
      ipnId: 'registered-ipn-id',
      registeredIpnUrl:
        'https://admin.halalconnect.space/api/public/payments/pesapal/ipn',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://cybqa.pesapal.com/pesapalv3/api/URLSetup/RegisterIPN',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          url: 'https://admin.halalconnect.space/api/public/payments/pesapal/ipn',
          ipn_notification_type: 'GET',
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it('does not register the same listener again after it is stored', async () => {
    const { service } = serviceWith();
    await service.saveSettings({
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      environment: 'sandbox',
      callbackUrl: 'https://example.test/payments/return',
      ipnId: 'registered-ipn-id',
      ipnUrl:
        'https://admin.halalconnect.space/api/public/payments/pesapal/ipn',
    });
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(service.registerIpn()).resolves.toMatchObject({
      ipnId: 'registered-ipn-id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('allows a complete credential replacement if saved credentials cannot be decrypted', async () => {
    const { service, prisma } = serviceWith({
      key: 'payments.pesapal.credentials',
      value: { iv: 'invalid', tag: 'invalid', ciphertext: 'invalid' },
    });

    await service.saveSettings({
      consumerKey: 'replacement-key',
      consumerSecret: 'replacement-secret',
      environment: 'live',
      callbackUrl: 'https://example.test/payments/return',
      ipnId: 'ipn-456',
      enabled: true,
      currency: 'UGX',
    });

    await expect(service.adminSettings()).resolves.toMatchObject({
      configured: true,
      enabled: true,
      environment: 'live',
      ipnId: 'ipn-456',
    });
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns the Pesapal IPN acknowledgement with the real merchant reference', async () => {
    const { service, paymentOrder } = serviceWith();
    jest
      .spyOn(service, 'refreshOrder')
      .mockResolvedValue({ status: 'pending' });

    await expect(
      service.processIpn('tracking-123', 'IPNCHANGE'),
    ).resolves.toEqual({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId: 'tracking-123',
      orderMerchantReference: 'merchant-ref',
      status: 200,
    });
    expect(paymentOrder.findUnique).toHaveBeenCalledWith({
      where: { orderTrackingId: 'tracking-123' },
      select: { merchantReference: true },
    });
  });

  it('returns a retryable Pesapal acknowledgement when IPN processing fails', async () => {
    const { service } = serviceWith();
    jest
      .spyOn(service, 'refreshOrder')
      .mockRejectedValue(new Error('status lookup failed'));

    await expect(service.processIpn('tracking-123')).resolves.toEqual({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId: 'tracking-123',
      orderMerchantReference: 'merchant-ref',
      status: 500,
    });
  });
});
