import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(code: string) { return code.trim().toUpperCase(); }

  private async activeCode(code: string) {
    const record = await this.prisma.discountCode.findUnique({ where: { code: this.normalize(code) } });
    if (!record || !record.active || (record.expiresAt && record.expiresAt <= new Date())) return null;
    if (record.usageLimit != null && record.usedCount + record.reservedCount >= record.usageLimit) return null;
    return record;
  }

  private appliesTo(code: string, tier: string, interval: string) {
    if (code === 'all') return true;
    const key = tier === 'vip' ? 'vip_once' : `premium_${interval === 'year' ? 'yearly' : 'monthly'}`;
    return code === key;
  }

  async validate(codeText: string, planId?: string) {
    if (!codeText?.trim()) return { valid: false, percentOff: 0, appliesTo: 'all' };
    const code = await this.activeCode(codeText);
    if (!code) return { valid: false, percentOff: 0, appliesTo: 'all' };
    let discountAmountCents: number | undefined;
    let amountCents: number | undefined;
    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan || !this.appliesTo(code.appliesTo, plan.tier, plan.interval)) {
        return { valid: false, percentOff: 0, appliesTo: code.appliesTo };
      }
      discountAmountCents = code.type === 'percent'
        ? Math.floor(plan.priceCents * code.value / 100)
        : Math.min(plan.priceCents, this.fixedAmount(code.value, plan.currency));
      amountCents = plan.priceCents - discountAmountCents;
    }
    return {
      valid: true,
      percentOff: code.type === 'percent' ? code.value : 0,
      fixedAmountOff: code.type === 'fixed' ? code.value : 0,
      appliesTo: code.appliesTo,
      type: code.type,
      value: code.value,
      discountAmountCents,
      amountCents,
    };
  }

  private fixedAmount(value: number, currency: string) {
    const zeroDecimalCurrencies = new Set(['UGX', 'KES', 'TZS', 'RWF', 'BIF', 'XOF', 'XAF']);
    return value * (zeroDecimalCurrencies.has(currency.toUpperCase()) ? 1 : 100);
  }

  async calculate(codeText: string, plan: { id: string; tier: string; interval: string; priceCents: number; currency: string }) {
    const code = await this.activeCode(codeText);
    if (!code || !this.appliesTo(code.appliesTo, plan.tier, plan.interval)) {
      throw new BadRequestException('Discount code is invalid, expired, exhausted, or not applicable');
    }
    if (code.type === 'percent' && (code.value < 1 || code.value > 99)) {
      throw new BadRequestException('Discount percentage must be between 1 and 99');
    }
    const discountAmount = code.type === 'percent'
      ? Math.floor(plan.priceCents * code.value / 100)
      : Math.min(plan.priceCents, this.fixedAmount(code.value, plan.currency));
    return { code, discountAmount, amount: plan.priceCents - discountAmount };
  }

  async reserve(userId: string, orderId: string, codeId: string) {
    await this.prisma.$transaction(async (tx) => {
      const code = await tx.discountCode.findUnique({ where: { id: codeId } });
      if (!code || !code.active || (code.expiresAt && code.expiresAt <= new Date())) {
        throw new BadRequestException('Discount code is no longer available');
      }
      const availableLimit = code.usageLimit == null ? null : code.usageLimit - code.usedCount;
      const where: any = { id: codeId, active: true };
      if (availableLimit != null) where.reservedCount = { lt: availableLimit };
      const reserved = await tx.discountCode.updateMany({ where, data: { reservedCount: { increment: 1 } } });
      if (reserved.count !== 1) throw new BadRequestException('Discount code has reached its redemption limit');
      await tx.discountReservation.create({ data: { codeId, userId, orderId } });
    });
  }

  async redeem(tx: any, orderId: string) {
    const reservation = await tx.discountReservation.findUnique({ where: { orderId } });
    if (!reservation || reservation.status !== 'reserved') return;
    await tx.discountCode.update({
      where: { id: reservation.codeId },
      data: { reservedCount: { decrement: 1 }, usedCount: { increment: 1 } },
    });
    await tx.discountReservation.update({ where: { id: reservation.id }, data: { status: 'redeemed' } });
  }

  async release(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.discountReservation.findUnique({ where: { orderId } });
      if (!reservation || reservation.status !== 'reserved') return;
      await tx.discountCode.update({ where: { id: reservation.codeId }, data: { reservedCount: { decrement: 1 } } });
      await tx.discountReservation.update({ where: { id: reservation.id }, data: { status: 'released' } });
    });
  }

  list() {
    return this.prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: any) {
    const code = this.normalize(input.code ?? '');
    if (!/^[A-Z0-9_-]{3,48}$/.test(code)) throw new BadRequestException('Code must be 3-48 letters, numbers, hyphens, or underscores');
    if (!['percent', 'fixed'].includes(input.type) || !Number.isInteger(input.value) || input.value < 1) {
      throw new BadRequestException('A valid discount type and positive whole-number value are required');
    }
    if (input.type === 'percent' && input.value > 99) throw new BadRequestException('Percent discounts cannot exceed 99');
    if (input.usageLimit != null && (!Number.isInteger(input.usageLimit) || input.usageLimit < 1)) {
      throw new BadRequestException('usageLimit must be a positive whole number');
    }
    return this.prisma.discountCode.create({
      data: {
        code,
        type: input.type,
        value: input.value,
        appliesTo: input.appliesTo ?? 'all',
        usageLimit: input.usageLimit ?? null,
        active: input.active ?? true,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
  }

  async update(id: string, input: any) {
    const current = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Discount code not found');
    if (input.value !== undefined && (!Number.isInteger(input.value) || input.value < 1 || (current.type === 'percent' && input.value > 99))) {
      throw new BadRequestException('Invalid discount value');
    }
    return this.prisma.discountCode.update({
      where: { id },
      data: {
        ...(input.active !== undefined && { active: !!input.active }),
        ...(input.value !== undefined && { value: input.value }),
        ...(input.appliesTo !== undefined && { appliesTo: input.appliesTo }),
        ...(input.usageLimit !== undefined && { usageLimit: input.usageLimit == null ? null : Number(input.usageLimit) }),
        ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }),
      },
    });
  }
}