import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Plan } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { BillingProvider } from './dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeBus,
  ) {}

  private isDev() {
    return this.config.get('MODE') === 'Dev';
  }

  // Default catalogue, seeded on first access so the app has plans without a
  // separate seed step. The dashboard can edit these rows afterwards.
  private readonly defaults = [
    {
      tier: 'basic' as const,
      name: 'Basic',
      description: 'Essential features to get started',
      priceCents: 0,
      interval: 'month',
      sortOrder: 0,
      features: ['5 likes per day', 'Up to 5 active chats', 'Standard matches'],
    },
    {
      tier: 'premium' as const,
      name: 'Premium',
      description: 'Unlimited likes, chats and full visibility',
      priceCents: 999,
      interval: 'month',
      sortOrder: 1,
      features: [
        'Unlimited likes',
        'Unlimited chats',
        'See everyone who liked you',
        'Advanced filters',
        'No ads',
      ],
    },
    {
      tier: 'vip' as const,
      name: 'VIP',
      description: 'Lifetime access + exclusive privileges',
      priceCents: 9999,
      interval: 'once',
      sortOrder: 2,
      features: [
        'Everything in Premium',
        'Lifetime access',
        'VIP profile badge',
        'Priority support',
        'Profile boost',
      ],
    },
  ];

  private async ensureSeeded() {
    const count = await this.prisma.plan.count();
    if (count > 0) return;
    for (const p of this.defaults) {
      await this.prisma.plan.create({ data: { ...p, features: p.features as any } });
    }
    this.logger.log('🌱 Seeded default subscription plans');
  }

  async listPlans() {
    await this.ensureSeeded();
    const plans = await this.prisma.plan.findMany({
      where: { visible: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((p) => this.serializePlan(p));
  }

  private serializePlan(p: Plan) {
    return {
      id: p.id,
      tier: p.tier,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      price: this.formatPrice(p.priceCents, p.currency, p.interval),
      currency: p.currency,
      interval: p.interval,
      features: (p.features as string[] | null) ?? [],
      sortOrder: p.sortOrder,
    };
  }

  private formatPrice(cents: number, currency: string, interval: string): string {
    if (cents === 0) return 'Free';
    const symbol = currency === 'USD' ? '$' : `${currency} `;
    const amount = (cents / 100).toFixed(2);
    const suffix = interval === 'once' ? ' one-time' : `/${interval}`;
    return `${symbol}${amount}${suffix}`;
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true },
    });
    if (!sub) {
      return {
        tier: user?.plan ?? 'basic',
        status: 'active',
        provider: null,
        currentPeriodEnd: user?.planExpiresAt ?? null,
        cancelAtPeriodEnd: false,
        plan: null,
      };
    }
    return {
      tier: sub.plan.tier,
      status: sub.status,
      provider: sub.provider,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      plan: this.serializePlan(sub.plan),
    };
  }

  private periodEnd(interval: string): Date | null {
    if (interval === 'once') return null; // lifetime
    const days = interval === 'year' ? 365 : 30;
    return new Date(Date.now() + days * 86400000);
  }

  /// Activates a plan for the user: writes the subscription, flips the user's
  /// gating tier, and records a succeeded transaction. Used by both the dev
  /// checkout short-circuit and receipt verification.
  private async activate(
    userId: string,
    plan: Plan,
    provider: BillingProvider,
    externalId?: string,
  ) {
    const end = this.periodEnd(plan.interval);

    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        provider,
        status: 'active',
        externalId: externalId ?? null,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
      },
      create: {
        userId,
        planId: plan.id,
        provider,
        status: 'active',
        externalId: externalId ?? null,
        currentPeriodEnd: end,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: plan.tier,
        planExpiresAt: end,
        ...(plan.tier !== 'basic' && { likesUsedToday: 0, activeChatsCount: 0 }),
      },
    });

    await this.prisma.transaction.create({
      data: {
        userId,
        planId: plan.id,
        provider,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: 'succeeded',
        externalId: externalId ?? null,
      },
    });

    const sub = await this.getSubscription(userId);
    this.realtime.emitToUser(userId, 'subscription:updated', sub);

    // Live admin feed.
    this.realtime.emitAdminEvent('subscription', `New ${plan.name} subscription`, {
      userId,
      planId: plan.id,
      amountCents: plan.priceCents,
    });

    return sub;
  }

  private async planOrThrow(planId: string): Promise<Plan> {
    await this.ensureSeeded();
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  /// Begin checkout. For real providers this returns the next client action
  /// (Stripe session / native purchase). In Dev — or for the 'manual' provider
  /// used by internal tooling — the plan is activated immediately so the whole
  /// flow is testable end-to-end without external billing credentials.
  async checkout(userId: string, planId: string, provider: BillingProvider) {
    const plan = await this.planOrThrow(planId);

    // Free plan = instant downgrade to basic, no payment.
    if (plan.priceCents === 0) {
      const sub = await this.activate(userId, plan, 'manual');
      return { activated: true, subscription: sub };
    }

    // Internal/manual activation (e.g. dashboard) takes effect immediately.
    if (provider === 'manual') {
      const sub = await this.activate(userId, plan, provider, `manual_${Date.now()}`);
      return { activated: true, subscription: sub };
    }

    // Stripe: if a secret key is configured, create a real Checkout Session and
    // return its URL — the app opens it, and the `checkout.session.completed`
    // webhook activates the plan. This works in dev too (use a Stripe test key).
    if (provider === 'stripe') {
      const checkoutUrl = await this.createStripeCheckout(userId, plan);
      if (checkoutUrl) {
        return { activated: false, provider, requiresClientAction: true, checkoutUrl };
      }
      // No Stripe key configured → fall back to instant activation in dev so the
      // flow stays testable; otherwise report that it isn't configured.
      if (this.isDev()) {
        const sub = await this.activate(userId, plan, provider, `dev_${Date.now()}`);
        return { activated: true, subscription: sub };
      }
      return {
        activated: false,
        provider,
        requiresClientAction: true,
        checkoutUrl: null,
        message: 'Stripe is not configured on this server.',
      };
    }

    // Apple / Google IAP: the app runs the native purchase, then posts the
    // receipt to /billing/verify. In dev we activate immediately for testing.
    if (this.isDev()) {
      const sub = await this.activate(userId, plan, provider, `dev_${Date.now()}`);
      return { activated: true, subscription: sub };
    }
    return {
      activated: false,
      provider,
      requiresClientAction: true,
      message: 'Complete the purchase in-app, then submit the receipt to verify.',
    };
  }

  /// Creates a Stripe Checkout Session via Stripe's REST API (no SDK needed).
  /// Returns the hosted checkout URL, or null when STRIPE_SECRET_KEY is unset.
  /// Inline `price_data` is used so no pre-created Stripe products are required.
  private async createStripeCheckout(userId: string, plan: Plan): Promise<string | null> {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) return null;

    const isOneTime = plan.interval === 'once';
    const mode = isOneTime ? 'payment' : 'subscription';
    const successUrl =
      this.config.get<string>('STRIPE_SUCCESS_URL') ??
      'https://halalconnect.app/billing/success';
    const cancelUrl =
      this.config.get<string>('STRIPE_CANCEL_URL') ??
      'https://halalconnect.app/billing/cancel';

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('client_reference_id', userId);
    // The webhook reads these back to map the payment to an account + plan.
    params.set('metadata[userId]', userId);
    params.set('metadata[planId]', plan.id);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', plan.currency.toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(plan.priceCents));
    params.set('line_items[0][price_data][product_data][name]', plan.name);
    if (!isOneTime) {
      params.set(
        'line_items[0][price_data][recurring][interval]',
        plan.interval === 'year' ? 'year' : 'month',
      );
      params.set('subscription_data[metadata][userId]', userId);
      params.set('subscription_data[metadata][planId]', plan.id);
    }

    try {
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (!res.ok) {
        this.logger.error(`Stripe session create failed: ${res.status} ${await res.text()}`);
        return null;
      }
      const data: any = await res.json();
      return (data.url as string) ?? null;
    } catch (e) {
      this.logger.error(`Stripe session error: ${String(e)}`);
      return null;
    }
  }

  /// Verify a provider receipt and activate the plan. Real verification against
  /// Apple/Google/Stripe goes here; in Dev we trust the receipt so the flow can
  /// be exercised without store credentials.
  async verify(
    userId: string,
    provider: BillingProvider,
    planId: string,
    receipt?: string,
  ) {
    const plan = await this.planOrThrow(planId);

    const verified = this.isDev() ? true : await this.verifyWithProvider(provider, receipt);
    if (!verified) throw new BadRequestException('Receipt could not be verified');

    const sub = await this.activate(userId, plan, provider, receipt);
    return { activated: true, subscription: sub };
  }

  // Placeholder for real receipt validation (App Store / Play / Stripe).
  private async verifyWithProvider(
    _provider: BillingProvider,
    receipt?: string,
  ): Promise<boolean> {
    if (!receipt) return false;
    this.logger.warn('Receipt verification not configured — rejecting in non-dev mode');
    return false;
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('No active subscription');

    // For dev/lifetime we revoke immediately; for recurring we'd normally keep
    // access until currentPeriodEnd. We mark both so the client can show intent.
    await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'canceled', cancelAtPeriodEnd: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: 'basic', planExpiresAt: null },
    });

    const updated = await this.getSubscription(userId);
    this.realtime.emitToUser(userId, 'subscription:updated', updated);
    return updated;
  }

  // ── Webhook entry points (called by WebhooksService) ─────────
  /// Activate a plan for a user from a verified provider webhook.
  async activatePlan(
    userId: string,
    planId: string,
    provider: BillingProvider,
    externalId?: string,
  ) {
    const plan = await this.planOrThrow(planId);
    return this.activate(userId, plan, provider, externalId);
  }

  /// Expire/revoke a subscription (e.g. Stripe customer.subscription.deleted or
  /// a lapsed Apple/Google receipt). Downgrades the user to basic.
  async expireSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (sub) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { status: 'expired', cancelAtPeriodEnd: true },
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: 'basic', planExpiresAt: null },
    });
    const updated = await this.getSubscription(userId);
    this.realtime.emitToUser(userId, 'subscription:updated', updated);
    return updated;
  }

  async listTransactions(userId: string) {
    const txns = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return txns.map((t) => ({
      id: t.id,
      provider: t.provider,
      amountCents: t.amountCents,
      currency: t.currency,
      status: t.status,
      createdAt: t.createdAt,
    }));
  }
}
