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
    return { service, prisma };
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
});
