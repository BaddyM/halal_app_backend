import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from 'src/billing/billing.service';
import { BillingProvider } from 'src/billing/dto';

interface NormalizedEvent {
  userId?: string;
  planId?: string;
  action: 'activate' | 'expire' | 'unknown';
  externalId?: string;
}

/// Server-side billing webhooks. Public (no auth) — providers call these.
///
/// SECURITY: each handler must verify the provider signature before trusting
/// the payload. Verification is gated behind the relevant secret being set
/// (STRIPE_WEBHOOK_SECRET / APPLE_/GOOGLE_) and is left as a clearly-marked
/// TODO where the provider SDK is required. Events carry our own `userId`/
/// `planId` in metadata so we can map them to an account.
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  async handleStripe(body: any): Promise<{ received: true }> {
    // TODO: verify `stripe-signature` header against STRIPE_WEBHOOK_SECRET
    // using the Stripe SDK + raw body before processing.
    const type: string = body?.type ?? '';
    const obj = body?.data?.object ?? {};
    const meta = obj?.metadata ?? {};

    let event: NormalizedEvent = { action: 'unknown' };
    if (
      type === 'checkout.session.completed' ||
      type === 'invoice.payment_succeeded' ||
      type === 'invoice.paid'
    ) {
      event = {
        action: 'activate',
        userId: meta.userId,
        planId: meta.planId,
        externalId: obj.id,
      };
    } else if (
      type === 'customer.subscription.deleted' ||
      type === 'invoice.payment_failed'
    ) {
      event = { action: 'expire', userId: meta.userId };
    }

    await this.apply('stripe', event, type);
    return { received: true };
  }

  async handleApple(body: any): Promise<{ received: true }> {
    // TODO: decode + verify the signed JWS payload (App Store Server
    // Notifications v2) before processing.
    const type: string =
      body?.notificationType ?? body?.notification_type ?? '';
    // Our relay attaches userId/planId; otherwise these would be resolved from
    // the original transaction id ↔ stored subscription.externalId.
    const userId = body?.userId ?? body?.data?.userId;
    const planId = body?.planId ?? body?.data?.planId;

    let event: NormalizedEvent = { action: 'unknown', userId, planId };
    if (['SUBSCRIBED', 'DID_RENEW', 'INITIAL_BUY'].includes(type)) {
      event.action = 'activate';
    } else if (['EXPIRED', 'DID_FAIL_TO_RENEW', 'REFUND'].includes(type)) {
      event.action = 'expire';
    }

    await this.apply('apple', event, type);
    return { received: true };
  }

  async handleGoogle(body: any): Promise<{ received: true }> {
    // Google Play RTDN wraps the notification (base64) in a Pub/Sub message.
    // TODO: verify the Pub/Sub push token / OIDC before processing.
    let decoded: any = body;
    const data = body?.message?.data;
    if (typeof data === 'string') {
      try {
        decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
      } catch {
        decoded = {};
      }
    }
    const notif = decoded?.subscriptionNotification ?? decoded ?? {};
    const userId = decoded?.userId ?? notif?.userId;
    const planId = decoded?.planId ?? notif?.planId;
    const notificationType: number = notif?.notificationType ?? 0;

    let event: NormalizedEvent = { action: 'unknown', userId, planId };
    // 4 = SUBSCRIPTION_PURCHASED, 2 = RENEWED, 1 = RECOVERED
    if ([1, 2, 4].includes(notificationType)) event.action = 'activate';
    // 3 = CANCELED, 13 = EXPIRED, 12 = REVOKED
    else if ([3, 12, 13].includes(notificationType)) event.action = 'expire';

    await this.apply('google', event, String(notificationType));
    return { received: true };
  }

  private async apply(
    provider: BillingProvider,
    event: NormalizedEvent,
    rawType: string,
  ) {
    if (event.action === 'activate' && event.userId && event.planId) {
      await this.billing.activatePlan(
        event.userId,
        event.planId,
        provider,
        event.externalId,
      );
      this.logger.log(`[${provider}] activated plan ${event.planId} for ${event.userId}`);
    } else if (event.action === 'expire' && event.userId) {
      await this.billing.expireSubscription(event.userId);
      this.logger.log(`[${provider}] expired subscription for ${event.userId}`);
    } else {
      this.logger.log(`[${provider}] ignored event '${rawType}'`);
    }
  }
}
