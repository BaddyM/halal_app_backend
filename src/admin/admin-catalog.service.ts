import { Injectable, NotFoundException } from '@nestjs/common';
import { AdAudience, AdPlacement } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAdDto, UpdateAdDto, UpdateIslamicSettingsDto, UpdatePlanDto } from './dto';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ads ────────────────────────────────────────────────────
  async listAds() {
    return this.prisma.ad.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
  }

  async createAd(dto: CreateAdDto) {
    return this.prisma.ad.create({
      data: {
        title: dto.title,
        body: dto.body ?? null,
        imageUrl: dto.imageUrl ?? null,
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
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
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

  // ── Plans ──────────────────────────────────────────────────
  async listPlans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.plan.update({
      where: { id },
      data: {
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
