import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdAudience, AdPlacement, SubscriptionPlan } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import {
  AttachSubscriptionDto,
  CreateAdDto,
  CreatePlanDto,
  UpdateAdDto,
  UpdateIslamicSettingsDto,
  UpdatePlanDto,
  UpdateSubscriptionDto,
} from './dto';

const AD_IMAGE_DEST = './uploads/ads';
const AD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DATA_URL_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeBus,
  ) {}

  /// Accepts the dashboard's image input. A `data:` URL (base64) is decoded and
  /// written to `uploads/ads/`, returning the served `/uploads/...` path so the
  /// mobile app can render it via Image.network. Already-persisted URLs
  /// (`/uploads/...` or `http(s)://`) and empty values pass through unchanged.
  private persistAdImage(imageUrl?: string | null): string | null {
    if (imageUrl === undefined || imageUrl === null || imageUrl === '') return null;
    if (!imageUrl.startsWith('data:')) return imageUrl;

    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(imageUrl);
    if (!match) throw new BadRequestException('Invalid image data');
    const [, mime, isBase64, payload] = match;
    const ext = DATA_URL_EXT[mime.toLowerCase()];
    if (!ext) throw new BadRequestException('Only JPG, PNG, WEBP or GIF images allowed');

    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf-8');
    if (buffer.byteLength > AD_IMAGE_MAX_BYTES) {
      throw new BadRequestException('Image must be under 5MB');
    }

    if (!existsSync(AD_IMAGE_DEST)) mkdirSync(AD_IMAGE_DEST, { recursive: true });
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    writeFileSync(join(AD_IMAGE_DEST, filename), buffer);
    return `/uploads/ads/${filename}`;
  }

  // ── Ads ────────────────────────────────────────────────────
  async listAds() {
    return this.prisma.ad.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
  }

  async createAd(dto: CreateAdDto) {
    return this.prisma.ad.create({
      data: {
        title: dto.title,
        body: dto.body ?? null,
        imageUrl: this.persistAdImage(dto.imageUrl),
        ctaText: dto.ctaText ?? null,
        targetUrl: dto.targetUrl ?? null,
        placement: dto.placement as AdPlacement,
        audience: (dto.audience ?? 'ALL') as AdAudience,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateAd(id: string, dto: UpdateAdDto) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Ad not found');
    return this.prisma.ad.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.imageUrl !== undefined && { imageUrl: this.persistAdImage(dto.imageUrl) }),
        ...(dto.ctaText !== undefined && { ctaText: dto.ctaText }),
        ...(dto.targetUrl !== undefined && { targetUrl: dto.targetUrl }),
        ...(dto.placement !== undefined && { placement: dto.placement as AdPlacement }),
        ...(dto.audience !== undefined && { audience: dto.audience as AdAudience }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.startsAt !== undefined && { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }),
        ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteAd(id: string) {
    await this.prisma.ad.deleteMany({ where: { id } });
    return { success: true };
  }

  // ── Plans (subscription packages) ──────────────────────────
  async listPlans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createPlan(dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        tier: dto.tier as SubscriptionPlan,
        name: dto.name,
        description: dto.description ?? null,
        priceCents: dto.priceCents ?? 0,
        currency: dto.currency ?? 'USD',
        interval: dto.interval ?? 'month',
        features: (dto.features ?? []) as any,
        visible: dto.visible ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.tier !== undefined && { tier: dto.tier as SubscriptionPlan }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priceCents !== undefined && { priceCents: dto.priceCents }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.interval !== undefined && { interval: dto.interval }),
        ...(dto.features !== undefined && { features: dto.features as any }),
        ...(dto.visible !== undefined && { visible: dto.visible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deletePlan(id: string) {
    const inUse = await this.prisma.subscription.count({ where: { planId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete a plan with ${inUse} active subscription(s). Reassign them first.`,
      );
    }
    await this.prisma.plan.deleteMany({ where: { id } });
    return { success: true };
  }

  // ── Subscriptions ──────────────────────────────────────────
  async listSubscriptions() {
    const subs = await this.prisma.subscription.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        plan: true,
        user: { include: { profile: true } },
      },
    });
    return subs.map((s) => this.serializeSubscription(s));
  }

  private serializeSubscription(s: any) {
    const p = s.user?.profile ?? {};
    return {
      id: s.id,
      userId: s.userId,
      userName: s.user?.name ?? '—',
      userEmail: s.user?.email ?? '—',
      gender: p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : null,
      country: p.country ?? null,
      city: p.city ?? null,
      userStatus: s.user?.status ?? null,
      planId: s.planId,
      planName: s.plan?.name ?? '—',
      tier: s.plan?.tier ?? null,
      priceCents: s.plan?.priceCents ?? 0,
      currency: s.plan?.currency ?? 'USD',
      interval: s.plan?.interval ?? 'month',
      provider: s.provider,
      status: s.status,
      externalId: s.externalId ?? null,
      currentPeriodEnd: s.currentPeriodEnd,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  /// Attach (create or replace) a subscription for a user and sync their plan
  /// gating tier. Subscription.userId is unique, so this upserts by user.
  async attachSubscription(dto: AttachSubscriptionDto) {
    const [user, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } }),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!plan) throw new NotFoundException('Plan not found');

    const status = dto.status ?? 'active';
    const periodEnd = dto.currentPeriodEnd
      ? new Date(dto.currentPeriodEnd)
      : this.defaultPeriodEnd(plan.interval);

    const sub = await this.prisma.subscription.upsert({
      where: { userId: dto.userId },
      update: {
        planId: plan.id,
        provider: dto.provider ?? 'manual',
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
      },
      create: {
        userId: dto.userId,
        planId: plan.id,
        provider: dto.provider ?? 'manual',
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
      },
      include: { plan: true, user: { include: { profile: true } } },
    });

    await this.syncUserPlan(dto.userId, status === 'active' ? plan.tier : 'basic', periodEnd);
    this.realtime.emitToUser(dto.userId, 'subscription:updated', { tier: plan.tier, status });
    this.realtime.emitAdminEvent('subscription', `${plan.name} attached`, {
      userId: dto.userId,
      planId: plan.id,
    });
    return this.serializeSubscription(sub);
  }

  async updateSubscription(id: string, dto: UpdateSubscriptionDto) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subscription not found');

    let plan = await this.prisma.plan.findUnique({ where: { id: existing.planId } });
    if (dto.planId && dto.planId !== existing.planId) {
      plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Plan not found');
    }

    const sub = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.planId !== undefined && { planId: dto.planId }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: dto.cancelAtPeriodEnd }),
        ...(dto.currentPeriodEnd !== undefined && {
          currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
        }),
      },
      include: { plan: true, user: { include: { profile: true } } },
    });

    // Keep the user's gating tier in step with the subscription state.
    const effectiveTier =
      sub.status === 'active' && plan ? plan.tier : 'basic';
    await this.syncUserPlan(existing.userId, effectiveTier, sub.currentPeriodEnd);
    this.realtime.emitToUser(existing.userId, 'subscription:updated', {
      tier: effectiveTier,
      status: sub.status,
    });
    return this.serializeSubscription(sub);
  }

  async deleteSubscription(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    await this.prisma.subscription.delete({ where: { id } });
    // Drop the user back to the free tier.
    await this.syncUserPlan(sub.userId, 'basic', null);
    this.realtime.emitToUser(sub.userId, 'subscription:updated', { tier: 'basic', status: 'canceled' });
    return { success: true };
  }

  private defaultPeriodEnd(interval: string): Date | null {
    if (interval === 'once') return null; // lifetime
    const days = interval === 'year' ? 365 : 30;
    return new Date(Date.now() + days * 86400000);
  }

  private async syncUserPlan(
    userId: string,
    tier: SubscriptionPlan,
    planExpiresAt: Date | null,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: tier,
        planExpiresAt,
        ...(tier !== 'basic' && { likesUsedToday: 0, activeChatsCount: 0 }),
      },
    });
  }

  // ── Islamic settings ───────────────────────────────────────
  async getIslamicSettings() {
    return this.prisma.islamicSetting.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  async updateIslamicSettings(dto: UpdateIslamicSettingsDto) {
    return this.prisma.islamicSetting.upsert({
      where: { id: 1 },
      update: { ...dto },
      create: { id: 1, ...dto },
    });
  }
}
