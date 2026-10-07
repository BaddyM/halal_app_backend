import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { BillingService } from './billing.service';
import { DiscountsService } from './discounts.service';

type PesapalEnvironment = 'sandbox' | 'live';
type PesapalSettings = {
  consumerKey: string;
  consumerSecret: string;
  environment: PesapalEnvironment;
  callbackUrl: string;
  ipnId: string;
  ipnUrl?: string;
  enabled: boolean;
  currency: string;
};

const SETTING_KEY = 'payments.pesapal.credentials';

@Injectable()
export class PesapalService {
  private readonly logger = new Logger(PesapalService.name);
  private tokenCache?: { token: string; expiresAt: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    private readonly discounts: DiscountsService,
    private readonly realtime: RealtimeBus,
  ) {}

  private encryptionKey(): Buffer {
    const raw =
      this.config.get<string>('PAYMENT_KEYS_ENCRYPTION_KEY') ??
      this.config.get<string>('PAYMENT_CONFIG_ENCRYPTION_KEY');
    if (!raw)
      throw new ServiceUnavailableException(
        'Payment config encryption is not configured',
      );
    const key = /^[a-f\d]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'Payment config encryption key must contain 32 bytes',
      );
    }
    return key;
  }

  private encrypt(settings: PesapalSettings) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(settings), 'utf8'),
      cipher.final(),
    ]);
    return {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  private decrypt(value: any): PesapalSettings {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        Buffer.from(value.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext) as PesapalSettings;
    } catch (error) {
      this.logger.error(`Could not decrypt Pesapal settings: ${String(error)}`);
      throw new ServiceUnavailableException(
        'Stored Pesapal settings cannot be decrypted',
      );
    }
  }

  private async settingsOrNull(): Promise<PesapalSettings | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    if (row) return this.decrypt(row.value);
    const consumerKey = this.config.get<string>('PESAPAL_CONSUMER_KEY');
    const consumerSecret = this.config.get<string>('PESAPAL_CONSUMER_SECRET');
    const callbackUrl = this.config.get<string>('PESAPAL_CALLBACK_URL');
    const ipnId = this.config.get<string>('PESAPAL_IPN_ID');
    if (!consumerKey || !consumerSecret || !callbackUrl || !ipnId) return null;
    return {
      consumerKey,
      consumerSecret,
      environment:
        this.config.get<PesapalEnvironment>('PESAPAL_ENVIRONMENT') === 'live'
          ? 'live'
          : 'sandbox',
      callbackUrl,
      ipnId,
      enabled: true,
      currency: this.config.get<string>('PAYMENT_CURRENCY', 'UGX'),
    };
  }

  private async settings(): Promise<PesapalSettings> {
    const settings = await this.settingsOrNull();
    if (!settings) {
      throw new ServiceUnavailableException(
        'Pesapal is not configured by the dashboard',
      );
    }
    return settings;
  }

  private baseUrl(environment: PesapalEnvironment) {
    return environment === 'live'
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';
  }

  async saveSettings(input: Partial<PesapalSettings>) {
    let current: PesapalSettings | null;
    try {
      current = await this.settingsOrNull();
    } catch (error) {
      const completeReplacement =
        error instanceof ServiceUnavailableException &&
        error.message === 'Stored Pesapal settings cannot be decrypted' &&
        !!input.consumerKey?.trim() &&
        !!input.consumerSecret?.trim() &&
        !!input.callbackUrl?.trim() &&
        !!input.ipnId?.trim() &&
        (input.environment === 'sandbox' || input.environment === 'live');
      if (!completeReplacement) throw error;
      current = null;
      this.logger.warn(
        'Replacing undecryptable Pesapal settings with complete admin input',
      );
    }
    const next = {
      consumerKey: input.consumerKey ?? current?.consumerKey ?? '',
      consumerSecret: input.consumerSecret ?? current?.consumerSecret ?? '',
      environment: input.environment ?? current?.environment ?? 'sandbox',
      callbackUrl: input.callbackUrl ?? current?.callbackUrl ?? '',
      ipnId: input.ipnId ?? current?.ipnId ?? '',
      ipnUrl: input.ipnUrl ?? current?.ipnUrl ?? '',
      enabled: input.enabled ?? current?.enabled ?? false,
      currency:
        input.currency?.trim().toUpperCase() ?? current?.currency ?? 'UGX',
    } as PesapalSettings;
    if (
      !next.consumerKey ||
      !next.consumerSecret ||
      !next.callbackUrl
    ) {
      throw new BadRequestException(
        'consumerKey, consumerSecret and callbackUrl are required',
      );
    }
    if (next.enabled && !next.ipnId) {
      throw new BadRequestException(
        'Register the Pesapal IPN listener before accepting payments',
      );
    }
    if (!['sandbox', 'live'].includes(next.environment)) {
      throw new BadRequestException('environment must be sandbox or live');
    }
    const encrypted = this.encrypt(next);
    await this.prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: encrypted },
      create: { key: SETTING_KEY, value: encrypted },
    });
    this.tokenCache = undefined;
    return this.adminSettings();
  }

  async adminSettings() {
    const settings = await this.settingsOrNull();
    return {
      configured: !!settings,
      provider: 'pesapal',
      environment: settings?.environment ?? 'sandbox',
      callbackUrl: settings?.callbackUrl ?? null,
      ipnId: settings?.ipnId || null,
      consumerKeyConfigured: !!settings?.consumerKey,
      consumerSecretConfigured: !!settings?.consumerSecret,
      hasCredentials: !!settings?.consumerKey && !!settings?.consumerSecret,
      enabled: settings?.enabled ?? false,
      currency: settings?.currency ?? 'UGX',
      apiBaseUrl: this.baseUrl(settings?.environment ?? 'sandbox'),
      registeredIpnUrl: settings?.ipnUrl ?? null,
      ipnListenerUrl:
        this.config.get<string>('PESAPAL_IPN_URL') ??
        'https://admin.halalconnect.space/api/public/payments/pesapal/ipn',
    };
  }

  async registerIpn() {
    const settings = await this.settings();
    const url =
      this.config.get<string>('PESAPAL_IPN_URL') ??
      'https://admin.halalconnect.space/api/public/payments/pesapal/ipn';
    if (settings.ipnId && settings.ipnUrl === url) {
      return {
        ipnId: settings.ipnId,
        ipnListenerUrl:
          this.config.get<string>('PESAPAL_IPN_URL') ??
          'https://admin.halalconnect.space/api/public/payments/pesapal/ipn',
        notificationType: 'GET',
      };
    }
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.pathname !== '/api/public/payments/pesapal/ipn' ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new ServiceUnavailableException(
        'PESAPAL_IPN_URL must be the HTTPS Pesapal notification endpoint',
      );
    }

    const response = await fetch(
      `${this.baseUrl(settings.environment)}/api/URLSetup/RegisterIPN`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.accessToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          url,
          ipn_notification_type: 'GET',
        }),
      },
    );
    const payload: any = await response.json().catch(() => ({}));
    const ipnId = String(payload.ipn_id ?? payload.ipnId ?? '').trim();
    if (!response.ok || !ipnId) {
      this.logger.warn(
        `Pesapal IPN registration failed with HTTP ${response.status}`,
      );
      throw new ServiceUnavailableException(
        'Pesapal did not register the IPN listener. Check the selected mode and credentials.',
      );
    }
    const saved = await this.saveSettings({ ipnId, ipnUrl: url });
    return {
      ipnId: saved.ipnId,
      ipnListenerUrl: url,
      notificationType: 'GET',
    };
  }

  adminTransactions(status?: string, search?: string) {
    return this.prisma.paymentOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { merchantReference: { contains: search } },
                { orderTrackingId: { contains: search } },
                {
                  user: {
                    OR: [
                      { name: { contains: search } },
                      { email: { contains: search } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async publicConfig() {
    const plans = await this.billing.listPlans();
    const settings = await this.settingsOrNull();
    const giftCount = await this.prisma.giftCatalogItem.count({
      where: { enabled: true },
    });
    const thresholdSetting = await this.prisma.appSetting.findUnique({
      where: { key: 'wallet.withdrawalThreshold' },
    });
    return {
      provider: 'pesapal',
      currency:
        settings?.currency ??
        plans[0]?.currency ??
        this.config.get<string>('PAYMENT_CURRENCY', 'UGX'),
      plans,
      giftsEnabled: giftCount > 0,
      withdrawalThreshold: Number(
        thresholdSetting?.value ??
          this.config.get('WITHDRAWAL_THRESHOLD', 50000),
      ),
      enabled: settings?.enabled ?? false,
    };
  }

  private async requestAccessToken(settings: PesapalSettings): Promise<string> {
    const response = await fetch(
      `${this.baseUrl(settings.environment)}/api/Auth/RequestToken`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          consumer_key: settings.consumerKey,
          consumer_secret: settings.consumerSecret,
        }),
      },
    );
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.token) {
      throw new ServiceUnavailableException('Pesapal authentication failed');
    }
    return payload.token as string;
  }

  private async accessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 30_000) {
      return this.tokenCache.token;
    }
    const settings = await this.settings();
    const token = await this.requestAccessToken(settings);
    this.tokenCache = { token, expiresAt: Date.now() + 4 * 60_000 };
    return token;
  }

  async testConnection(input?: {
    consumerKey?: string;
    consumerSecret?: string;
    environment?: PesapalEnvironment;
  }) {
    if (
      input?.environment !== undefined &&
      input.environment !== 'sandbox' &&
      input.environment !== 'live'
    ) {
      throw new BadRequestException('environment must be sandbox or live');
    }
    if (input?.consumerKey || input?.consumerSecret) {
      if (!input.consumerKey?.trim() || !input.consumerSecret?.trim()) {
        throw new BadRequestException(
          'Enter both Pesapal credentials to test them',
        );
      }
      const settings: PesapalSettings = {
        consumerKey: input.consumerKey.trim(),
        consumerSecret: input.consumerSecret.trim(),
        environment: input.environment ?? 'sandbox',
        callbackUrl: '',
        ipnId: '',
        enabled: false,
        currency: 'UGX',
      };
      await this.requestAccessToken(settings);
    } else if (input?.environment) {
      const current = await this.settings();
      await this.requestAccessToken({
        ...current,
        environment: input.environment,
      });
    } else {
      await this.accessToken();
    }
    return { ok: true, provider: 'pesapal' };
  }

  async createSubscriptionCheckout(
    userId: string,
    planId: string,
    discountCode?: string,
  ) {
    const settings = await this.settings();
    if (!settings.enabled)
      throw new ServiceUnavailableException(
        'Pesapal payments are currently disabled',
      );
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, visible: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.priceCents <= 0)
      throw new BadRequestException('A free plan does not require checkout');
    const pricing = discountCode
      ? await this.discounts.calculate(discountCode, plan)
      : { code: null, discountAmount: 0, amount: plan.priceCents };
    if (pricing.amount <= 0)
      throw new BadRequestException(
        'Discounted checkout amount must be greater than zero',
      );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const merchantReference = randomUUID();
    const order = await this.prisma.paymentOrder.create({
      data: {
        userId,
        itemType: 'subscription',
        itemId: plan.id,
        merchantReference,
        subtotalAmountCents: plan.priceCents,
        discountAmountCents: pricing.discountAmount,
        discountCodeId: pricing.code?.id ?? null,
        amountCents: pricing.amount,
        currency: plan.currency,
      },
    });
    if (pricing.code) {
      try {
        await this.discounts.reserve(userId, order.id, pricing.code.id);
      } catch (error) {
        await this.prisma.paymentOrder.delete({ where: { id: order.id } });
        throw error;
      }
    }
    try {
      const token = await this.accessToken();
      const [firstName, ...lastParts] = user.name.trim().split(/\s+/);
      const response = await fetch(
        `${this.baseUrl(settings.environment)}/api/Transactions/SubmitOrderRequest`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            id: merchantReference,
            currency: plan.currency,
            amount: this.toProviderAmount(pricing.amount, plan.currency, true),
            description: `${plan.name} subscription`,
            callback_url: settings.callbackUrl,
            notification_id: settings.ipnId,
            billing_address: {
              email_address: user.email,
              first_name: firstName ?? user.name,
              last_name: lastParts.join(' '),
            },
          }),
        },
      );
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok || !payload.order_tracking_id || !payload.redirect_url) {
        throw new ServiceUnavailableException(
          'Pesapal could not create the checkout order',
        );
      }
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          orderTrackingId: String(payload.order_tracking_id),
          redirectUrl: String(payload.redirect_url),
        },
      });
      return {
        redirectUrl: payload.redirect_url,
        orderTrackingId: payload.order_tracking_id,
      };
    } catch (error) {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      await this.discounts.release(order.id);
      throw error;
    }
  }

  async createGiftCheckout(userId: string, giftId: string, quantity: number) {
    const settings = await this.settings();
    if (!settings.enabled)
      throw new ServiceUnavailableException(
        'Pesapal payments are currently disabled',
      );
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new BadRequestException('quantity must be between 1 and 20');
    }
    const gift = await this.prisma.giftCatalogItem.findFirst({
      where: { id: giftId, enabled: true },
    });
    if (!gift) throw new NotFoundException('Gift not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const merchantReference = randomUUID();
    const order = await this.prisma.paymentOrder.create({
      data: {
        userId,
        itemType: 'gift',
        itemId: gift.id,
        merchantReference,
        quantity,
        amountCents: gift.price * quantity,
        currency: gift.currency,
      },
    });
    try {
      const token = await this.accessToken();
      const [firstName, ...lastParts] = user.name.trim().split(/\s+/);
      const response = await fetch(
        `${this.baseUrl(settings.environment)}/api/Transactions/SubmitOrderRequest`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            id: merchantReference,
            currency: gift.currency,
            amount: this.toProviderAmount(
              gift.price * quantity,
              gift.currency,
              false,
            ),
            description: `${quantity} x ${gift.name}`,
            callback_url: settings.callbackUrl,
            notification_id: settings.ipnId,
            billing_address: {
              email_address: user.email,
              first_name: firstName ?? user.name,
              last_name: lastParts.join(' '),
            },
          }),
        },
      );
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok || !payload.order_tracking_id || !payload.redirect_url) {
        throw new ServiceUnavailableException(
          'Pesapal could not create the checkout order',
        );
      }
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          orderTrackingId: String(payload.order_tracking_id),
          redirectUrl: String(payload.redirect_url),
        },
      });
      return {
        redirectUrl: payload.redirect_url,
        orderTrackingId: payload.order_tracking_id,
      };
    } catch (error) {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      await this.discounts.release(order.id);
      throw error;
    }
  }

  private toProviderAmount(
    amount: number,
    currency: string,
    priceStoredInMinorUnits: boolean,
  ) {
    const zeroDecimalCurrencies = new Set([
      'UGX',
      'KES',
      'TZS',
      'RWF',
      'BIF',
      'XOF',
      'XAF',
    ]);
    return priceStoredInMinorUnits &&
      !zeroDecimalCurrencies.has(currency.toUpperCase())
      ? amount / 100
      : amount;
  }

  private async fulfillGiftOrder(order: {
    id: string;
    userId: string;
    itemId: string;
    quantity: number;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.giftInventory.upsert({
        where: {
          userId_giftId: { userId: order.userId, giftId: order.itemId },
        },
        create: {
          userId: order.userId,
          giftId: order.itemId,
          quantity: order.quantity,
        },
        update: { quantity: { increment: order.quantity } },
      });
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          providerStatus: 'COMPLETED',
        },
      });
      await this.discounts.redeem(tx, order.id);
    });
  }

  private async providerStatus(orderTrackingId: string) {
    const settings = await this.settings();
    const token = await this.accessToken();
    const url = new URL(
      `${this.baseUrl(settings.environment)}/api/Transactions/GetTransactionStatus`,
    );
    url.searchParams.set('orderTrackingId', orderTrackingId);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Could not retrieve payment status from Pesapal',
      );
    return String(
      result.payment_status_description ?? result.status ?? 'PENDING',
    ).toUpperCase();
  }

  async refreshOrder(userId: string | null, orderTrackingId: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { orderTrackingId },
    });
    if (!order || (userId && order.userId !== userId))
      throw new NotFoundException('Payment order not found');
    if (order.status === 'completed') return { status: 'completed' };
    if (order.status === 'processing') return { status: 'pending' };
    const providerStatus = await this.providerStatus(orderTrackingId);
    if (providerStatus === 'COMPLETED') {
      const claim = await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'pending' },
        data: { status: 'processing', providerStatus },
      });
      if (claim.count === 1) {
        try {
          if (order.itemType === 'subscription') {
            await this.billing.activateVerifiedPesapalPlan(
              order.userId,
              order.itemId,
              orderTrackingId,
            );
            await this.prisma.$transaction(async (tx) => {
              await tx.paymentOrder.update({
                where: { id: order.id },
                data: {
                  status: 'completed',
                  completedAt: new Date(),
                  providerStatus,
                },
              });
              await this.discounts.redeem(tx, order.id);
            });
          } else if (order.itemType === 'gift') {
            await this.fulfillGiftOrder(order);
          } else {
            throw new BadRequestException('Unsupported payment item');
          }
          if (order.itemType === 'gift') {
            this.realtime.emitAdminEvent('payment', 'Gift payment completed', {
              userId: order.userId,
              itemType: order.itemType,
              itemId: order.itemId,
              amountCents: order.amountCents,
              currency: order.currency,
            });
          }
        } catch (error) {
          await this.prisma.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'pending' },
          });
          throw error;
        }
      }
      const latest = await this.prisma.paymentOrder.findUnique({
        where: { id: order.id },
      });
      return {
        status: latest?.status === 'completed' ? 'completed' : 'pending',
      };
    }
    if (['FAILED', 'INVALID', 'REVERSED'].includes(providerStatus)) {
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'pending' },
        data: { status: 'failed', providerStatus },
      });
      await this.discounts.release(order.id);
      return { status: 'failed' };
    }
    await this.prisma.paymentOrder.updateMany({
      where: { id: order.id, status: 'pending' },
      data: { providerStatus },
    });
    return { status: 'pending' };
  }

  async processIpn(
    orderTrackingId: string,
    orderNotificationType = 'IPNCHANGE',
  ) {
    let orderMerchantReference = '';
    try {
      const order = await this.prisma.paymentOrder.findUnique({
        where: { orderTrackingId },
        select: { merchantReference: true },
      });
      if (!order) throw new NotFoundException('Payment order not found');
      orderMerchantReference = order.merchantReference;
      await this.refreshOrder(null, orderTrackingId);
      return {
        orderNotificationType,
        orderTrackingId,
        orderMerchantReference,
        status: 200,
      };
    } catch (error) {
      const code = error instanceof Error ? error.name : 'UNKNOWN_IPN_ERROR';
      this.logger.error(`Pesapal IPN processing failed (${code})`);
      return {
        orderNotificationType,
        orderTrackingId,
        orderMerchantReference,
        status: 500,
      };
    }
  }
}
