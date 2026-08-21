import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

@Injectable()
export class AdminMessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeBus,
  ) {}

  /// Resolve a target set from explicit ids and/or an audience segment.
  private async resolveTargets(
    userIds: string[] | undefined,
    audience: string | undefined,
  ): Promise<string[]> {
    const ids = new Set(userIds ?? []);

    // Explicit recipients only — never widen a targeted send into a segment.
    if (!audience) return [...ids];

    const DAY = 24 * 60 * 60 * 1000;
    const filters: Record<string, Prisma.UserWhereInput> = {
      all: {},
      free: { plan: 'basic' },
      premium: { plan: { not: 'basic' } },
      banned: { status: 'banned' },
      verified: { profile: { is: { isVerified: true } } },
      active: { lastSeenAt: { gt: new Date(Date.now() - 30 * DAY) } },
      new: { createdAt: { gt: new Date(Date.now() - 7 * DAY) } },
    };

    const where = filters[audience];
    if (where === undefined) {
      // Unknown segment: send to nobody rather than silently to everybody.
      throw new BadRequestException(`Unknown audience "${audience}"`);
    }

    const users = await this.prisma.user.findMany({ where, select: { id: true } });
    users.forEach((u) => ids.add(u.id));
    return [...ids];
  }

  /// Send an admin message (→ inbox + push) to a set of users / a segment.
  async sendBulk(input: {
    userIds?: string[];
    audience?: string;
    subject?: string;
    body: string;
  }) {
    const targets = await this.resolveTargets(input.userIds, input.audience);
    if (targets.length === 0) return { sent: 0 };

    await this.prisma.inboxMessage.createMany({
      data: targets.map((userId) => ({
        userId,
        fromAdmin: true,
        subject: input.subject ?? null,
        body: input.body,
      })),
    });

    for (const userId of targets) {
      this.realtime.emitToUser(userId, 'notification:new', { kind: 'inbox' });
      void this.push.sendToUser(userId, {
        title: input.subject ?? 'Message from Halal Connect',
        body: input.body.length > 120 ? `${input.body.slice(0, 120)}…` : input.body,
        data: { type: 'inbox' },
      });
    }
    return { sent: targets.length };
  }

  /// Broadcast an announcement: live in-app banner (admin:broadcast) for
  /// connected clients + inbox record + push for the targeted audience.
  async broadcast(
    title: string,
    message: string,
    audience?: string,
    userIds?: string[],
  ) {
    // Explicit recipients win: a targeted announcement must not also resolve a
    // segment, or "message these 3 users" becomes "message everyone".
    const direct = !!userIds?.length;
    const segment = direct ? undefined : (audience ?? 'all');
    const targets = await this.resolveTargets(userIds, segment);

    if (segment === 'all') {
      // Whole-population send — one cheap fan-out to every open socket.
      this.realtime.broadcast('admin:broadcast', { title, message });
    } else {
      // Targeted send: only the recipients get the in-app banner. Broadcasting
      // to every socket would show a "premium members only" notice to free users.
      for (const userId of targets) {
        this.realtime.emitToUser(userId, 'admin:broadcast', { title, message });
      }
    }

    if (targets.length > 0) {
      await this.prisma.inboxMessage.createMany({
        data: targets.map((userId) => ({
          userId,
          fromAdmin: true,
          subject: title,
          body: message,
        })),
      });
      for (const userId of targets) {
        this.realtime.emitToUser(userId, 'notification:new', { kind: 'broadcast' });
        void this.push.sendToUser(userId, { title, body: message, data: { type: 'broadcast' } });
      }
    }

    // Persist to the broadcast history shown in the dashboard.
    await this.prisma.broadcast.create({
      data: {
        title,
        message,
        audience: direct ? `direct:${targets.length}` : (audience ?? 'all'),
        reach: targets.length,
      },
    });

    return { sent: targets.length };
  }

  /// Recent broadcast history (newest first).
  async history(limit = 20) {
    const rows = await this.prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      audience: b.audience,
      reach: b.reach,
      createdAt: b.createdAt,
    }));
  }

  /// Live audience-size estimates for the compose form.
  async audienceCounts() {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const [all, active, premium, recent] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastSeenAt: { gt: new Date(now - 30 * DAY) } } }),
      this.prisma.user.count({ where: { plan: { not: 'basic' } } }),
      this.prisma.user.count({ where: { createdAt: { gt: new Date(now - 7 * DAY) } } }),
    ]);
    return { all, active, premium, new: recent };
  }

  // ── Admin ↔ user inbox (support chat) ──────────────────────
  /// Chat list: one entry per user who has any inbox correspondence, newest
  /// activity first, with a preview and the count of unread user replies.
  async inboxThreads() {
    const groups = await this.prisma.inboxMessage.groupBy({
      by: ['userId'],
      _max: { createdAt: true },
    });
    groups.sort(
      (a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0),
    );
    const top = groups.slice(0, 100);
    const ids = top.map((g) => g.userId);
    if (ids.length === 0) return [];

    const [users, recentMsgs, unreadGroups] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          email: true,
          photos: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
        },
      }),
      this.prisma.inboxMessage.findMany({
        where: { userId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        select: { userId: true, body: true, fromAdmin: true, createdAt: true },
      }),
      this.prisma.inboxMessage.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, fromAdmin: false, isRead: false },
        _count: { _all: true },
      }),
    ]);

    const lastByUser = new Map<string, (typeof recentMsgs)[number]>();
    for (const m of recentMsgs) if (!lastByUser.has(m.userId)) lastByUser.set(m.userId, m);
    const unreadByUser = new Map(unreadGroups.map((g) => [g.userId, g._count._all]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return top.map((g) => {
      const u = userById.get(g.userId);
      const last = lastByUser.get(g.userId);
      return {
        userId: g.userId,
        name: u?.name ?? 'Unknown',
        email: u?.email ?? null,
        photo: u?.photos[0]?.url ?? null,
        lastMessage: last
          ? last.body.length > 80
            ? `${last.body.slice(0, 80)}…`
            : last.body
          : '',
        lastFromAdmin: last?.fromAdmin ?? true,
        lastAt: g._max.createdAt,
        unread: unreadByUser.get(g.userId) ?? 0,
      };
    });
  }

  /// Full conversation with one user (all messages, chronological). Opening it
  /// marks that user's replies as read by the admin.
  async inboxThread(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        photos: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const messages = await this.prisma.inboxMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    await this.prisma.inboxMessage.updateMany({
      where: { userId, fromAdmin: false, isRead: false },
      data: { isRead: true },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        photo: user.photos[0]?.url ?? null,
      },
      messages: messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        body: m.body,
        fromAdmin: m.fromAdmin,
        createdAt: m.createdAt,
      })),
    };
  }

  /// Admin sends a message to a user → new inbox thread root + push + realtime.
  async inboxSend(userId: string, body: string, subject?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const msg = await this.prisma.inboxMessage.create({
      data: { userId, fromAdmin: true, subject: subject ?? null, body },
    });
    void this.push.sendToUser(userId, {
      title: subject ?? 'Message from Halal Connect',
      body: body.length > 120 ? `${body.slice(0, 120)}…` : body,
      data: { type: 'inbox', messageId: msg.id },
    });
    this.realtime.emitToUser(userId, 'notification:new', { kind: 'inbox' });

    return {
      id: msg.id,
      subject: msg.subject,
      body: msg.body,
      fromAdmin: true,
      createdAt: msg.createdAt,
    };
  }
}
