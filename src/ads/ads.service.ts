import { Injectable, NotFoundException } from '@nestjs/common';
import { Ad, AdPlacement } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Active ads for a placement, filtered by the viewer's plan audience and the
  /// ad's active window. Premium/VIP users only see ALL/PREMIUM ads; free users
  /// only see ALL/FREE.
  async list(userId: string, placement: AdPlacement) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const isPremium = !!user && user.plan !== 'basic';
    const audiences = isPremium ? ['ALL', 'PREMIUM'] : ['ALL', 'FREE'];
    const now = new Date();

    // Shared gate: active, within its run window, and visible to this audience.
    const baseWhere = {
      isActive: true,
      audience: { in: audiences as any },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };

    // Prefer ads targeted at this exact placement…
    let ads = await this.prisma.ad.findMany({
      where: { ...baseWhere, placement },
      orderBy: { sortOrder: 'asc' },
    });

    // …but if none target this slot, fall back to any active ad so uploaded
    // campaigns still surface everywhere instead of showing the house promo.
    if (ads.length === 0) {
      ads = await this.prisma.ad.findMany({
        where: baseWhere,
        orderBy: { sortOrder: 'asc' },
      });
    }

    return ads.map((a) => this.serialize(a));
  }

  private serialize(a: Ad) {
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      imageUrl: a.imageUrl,
      ctaText: a.ctaText,
      targetUrl: a.targetUrl,
      placement: a.placement,
    };
  }

  async recordImpression(id: string) {
    await this.bump(id, 'impressions');
    return { success: true };
  }

  async recordClick(id: string) {
    await this.bump(id, 'clicks');
    return { success: true };
  }

  private async bump(id: string, field: 'impressions' | 'clicks') {
    try {
      await this.prisma.ad.update({
        where: { id },
        data: { [field]: { increment: 1 } },
      });
    } catch {
      throw new NotFoundException('Ad not found');
    }
  }
}
