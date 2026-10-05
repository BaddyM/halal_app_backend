import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PesapalService } from 'src/billing/pesapal.service';
import { PushService } from 'src/push/push.service';

@Injectable()
export class GiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PesapalService,
    private readonly push: PushService,
  ) {}

  catalog() {
    return this.prisma.giftCatalogItem.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, image: true, price: true, currency: true },
    });
  }

  adminCatalog() {
    return this.prisma.giftCatalogItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createCatalogItem(input: { name: string; description?: string; image?: string; price: number; cashValue: number; currency?: string; enabled?: boolean; sortOrder?: number }) {
    if (!input.name?.trim() || !Number.isInteger(input.price) || input.price <= 0 ||
        !Number.isInteger(input.cashValue) || input.cashValue < 0 || input.cashValue > input.price) {
      throw new BadRequestException('Gift name, positive price and cash value between zero and price are required');
    }
    return this.prisma.giftCatalogItem.create({
      data: { ...input, name: input.name.trim(), currency: input.currency ?? 'UGX' },
    });
  }

  async updateCatalogItem(id: string, input: { name?: string; description?: string; image?: string; price?: number; cashValue?: number; currency?: string; enabled?: boolean; sortOrder?: number }) {
    const existing = await this.prisma.giftCatalogItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gift not found');
    const price = input.price ?? existing.price;
    const cashValue = input.cashValue ?? existing.cashValue;
    if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(cashValue) || cashValue < 0 || cashValue > price) {
      throw new BadRequestException('Cash value must be between zero and gift price');
    }
    return this.prisma.giftCatalogItem.update({
      where: { id },
      data: { ...input, ...(input.name !== undefined && { name: input.name.trim() }) },
    });
  }

  removeCatalogItem(id: string) {
    return this.prisma.giftCatalogItem.update({ where: { id }, data: { enabled: false } });
  }

  purchase(userId: string, giftId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new BadRequestException('quantity must be between 1 and 20');
    }
    return this.payments.createGiftCheckout(userId, giftId, quantity);
  }

  inventory(userId: string) {
    return this.prisma.giftInventory.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { gift: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async send(senderId: string, giftId: string, toUserId: string, quantity = 1, message?: string) {
    if (senderId === toUserId) throw new BadRequestException('You cannot send a gift to yourself');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new BadRequestException('quantity must be between 1 and 20');
    }
    const [gift, match, block, recipient, sender] = await Promise.all([
      this.prisma.giftCatalogItem.findFirst({ where: { id: giftId, enabled: true } }),
      this.prisma.match.findFirst({
        where: { OR: [{ userAId: senderId, userBId: toUserId }, { userAId: toUserId, userBId: senderId }] },
        select: { id: true },
      }),
      this.prisma.block.findFirst({
        where: { OR: [{ blockerId: senderId, blockedId: toUserId }, { blockerId: toUserId, blockedId: senderId }] },
        select: { id: true },
      }),
      this.prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: senderId }, select: { name: true } }),
    ]);
    if (!gift) throw new NotFoundException('Gift not found');
    if (!recipient) throw new NotFoundException('Recipient not found');
    if (!match || block) throw new ForbiddenException('Gifts can only be sent to an active match');

    const totalCashValue = gift.cashValue * quantity;
    const giftSent = await this.prisma.$transaction(async (tx) => {
      const removed = await tx.giftInventory.updateMany({
        where: { userId: senderId, giftId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (removed.count !== 1) throw new BadRequestException('You do not own this gift');
      const sent = await tx.giftSent.create({
        data: { giftId, senderId, recipientId: toUserId, quantity, message: message?.slice(0, 500), cashValue: totalCashValue },
      });
      await tx.walletAccount.upsert({
        where: { userId: toUserId },
        create: { userId: toUserId, balance: totalCashValue, lifetime: totalCashValue },
        update: { balance: { increment: totalCashValue }, lifetime: { increment: totalCashValue } },
      });
      if (totalCashValue > 0) {
        await tx.walletTransaction.create({
          data: {
            userId: toUserId,
            type: 'gift_received',
            amount: totalCashValue,
            currency: gift.currency,
            reference: `gift:${sent.id}`,
            description: `Gift received: ${gift.name}${quantity > 1 ? ` x ${quantity}` : ''}`,
          },
        });
      }
      return sent;
    });
    void this.push.sendToUser(toUserId, {
      title: 'Congratulations!',
      body: `${sender?.name ?? 'Someone'} gifted you${quantity > 1 ? ` ${quantity}` : ''} ${gift.name}. Tap to view your gifts.`,
      data: { type: 'gift_received', giftSentId: giftSent.id, fromName: sender?.name ?? '', giftName: gift.name, quantity },
    });
    return { success: true, gift: giftSent };
  }

  received(userId: string) {
    return this.prisma.giftSent.findMany({
      where: { recipientId: userId },
      include: { gift: true, sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}