import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(args: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: args.userId ?? null,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId ?? null,
        before: args.before ? JSON.stringify(args.before) : null,
        after: args.after ? JSON.stringify(args.after) : null,
      },
    });
  }

  async list(page: number, limit: number, entity?: string) {
    const where = entity ? { entity } : {};
    const data = await this.prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    const total = await this.prisma.auditLog.count({ where });
    return { data, totalPages: Math.ceil(total / limit) };
  }

  // Period locks
  async lock_period(period: string, lockedById: string, note?: string) {
    const existing = await this.prisma.periodLock.findUnique({
      where: { period },
    });
    if (existing) {
      throw new InternalServerErrorException('Period already locked');
    }
    const lock = await this.prisma.periodLock.create({
      data: { period, lockedById, note },
    });
    await this.log({
      userId: lockedById,
      action: 'LOCK',
      entity: 'PeriodLock',
      entityId: lock.id,
      after: { period, note },
    });
    return lock;
  }

  async unlock_period(id: string, userId: string) {
    const lock = await this.prisma.periodLock.findUnique({ where: { id } });
    if (!lock) {
      throw new InternalServerErrorException('Period lock not found');
    }
    await this.prisma.periodLock.delete({ where: { id } });
    await this.log({
      userId,
      action: 'UNLOCK',
      entity: 'PeriodLock',
      entityId: id,
      before: { period: lock.period },
    });
    return { ok: true };
  }

  async list_period_locks() {
    return this.prisma.periodLock.findMany({
      include: {
        lockedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { lockedAt: 'desc' },
    });
  }

  async is_locked(period: string) {
    const lock = await this.prisma.periodLock.findUnique({
      where: { period },
    });
    return { locked: !!lock };
  }
}
