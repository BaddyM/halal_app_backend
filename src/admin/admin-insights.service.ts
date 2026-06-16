import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard home stats ───────────────────────────────────
  async stats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      bannedToday,
      usersLastYear,
      premiumUsers,
      verifiedUsers,
      totalMatches,
      pendingReports,
      revenue,
      onlineNow,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { status: 'banned' } }),
      this.prisma.user.count({ where: { status: 'banned', updatedAt: { gte: startOfToday } } }),
      this.prisma.user.count({ where: { createdAt: { lte: oneYearAgo } } }),
      this.prisma.user.count({ where: { plan: { not: 'basic' } } }),
      this.prisma.profile.count({ where: { isVerified: true } }),
      this.prisma.match.count(),
      this.prisma.report.count({ where: { status: { in: ['open', 'pending'] } } }),
      this.prisma.transaction.aggregate({
        _sum: { amountCents: true },
        where: { status: 'succeeded' },
      }),
      this.prisma.user.count({
        where: { lastSeenAt: { gt: new Date(now.getTime() - ONLINE_WINDOW_MS) } },
      }),
    ]);

    // Year-over-year user growth %. Falls back to 100% when there were no users
    // a year ago but there are now.
    const usersYoyPercent =
      usersLastYear > 0
        ? Math.round(((totalUsers - usersLastYear) / usersLastYear) * 100)
        : totalUsers > 0
          ? 100
          : 0;

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      bannedToday,
      usersYoyPercent,
      premiumUsers,
      verifiedUsers,
      totalMatches,
      pendingReports,
      revenueCents: revenue._sum.amountCents ?? 0,
      onlineNow,
    };
  }

  // ── Analytics ──────────────────────────────────────────────
  /// Signups per month for the last `months` months.
  async userGrowth(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const u of users) {
      const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([month, count]) => ({ month, count }));
  }

  async genderRatio() {
    const [male, female, unset] = await Promise.all([
      this.prisma.profile.count({ where: { gender: 'male' } }),
      this.prisma.profile.count({ where: { gender: 'female' } }),
      this.prisma.profile.count({ where: { gender: null } }),
    ]);
    return [
      { label: 'Male', value: male },
      { label: 'Female', value: female },
      { label: 'Unspecified', value: unset },
    ];
  }

  async practiceBreakdown() {
    const groups = await this.prisma.profile.groupBy({
      by: ['prayerFrequency'],
      _count: { _all: true },
    });
    const map: Record<string, string> = {
      fiveTimes: 'Highly Practicing',
      mostPrayers: 'Practicing',
      jumuahOnly: 'Moderately',
      sometimes: 'Moderately',
    };
    const out = new Map<string, number>();
    for (const g of groups) {
      const label = map[g.prayerFrequency ?? ''] ?? 'Learning';
      out.set(label, (out.get(label) ?? 0) + g._count._all);
    }
    return [...out.entries()].map(([label, value]) => ({ label, value }));
  }

  async activity() {
    const now = Date.now();
    const [online, today, week] = await Promise.all([
      this.prisma.user.count({ where: { lastSeenAt: { gt: new Date(now - ONLINE_WINDOW_MS) } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gt: new Date(now - DAY_MS) } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gt: new Date(now - 7 * DAY_MS) } } }),
    ]);
    return { online, today, week };
  }

  // ── Audit logs ─────────────────────────────────────────────
  async logs(limit = 200) {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return logs.map((l) => ({
      id: l.id,
      admin: l.adminEmail ?? l.adminId ?? 'system',
      action: l.action,
      target: l.target,
      timestamp: l.createdAt,
    }));
  }

  // ── App settings (key/value flags) ─────────────────────────
  async getSettings() {
    const rows = await this.prisma.appSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async patchSettings(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values)) {
      await this.prisma.appSetting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      });
    }
    return this.getSettings();
  }

  // ── Conversations (moderation) ─────────────────────────────
  async listConversations(flaggedOnly = false) {
    const flaggedConvIds = new Set(
      (
        await this.prisma.message.findMany({
          where: { flagged: true },
          select: { conversationId: true },
          distinct: ['conversationId'],
        })
      ).map((m) => m.conversationId),
    );

    const convs = await this.prisma.conversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
    });

    return convs
      .filter((c) => !flaggedOnly || flaggedConvIds.has(c.id))
      .map((c) => ({
        id: c.id,
        participants: [c.userA.name, c.userB.name],
        participantIds: [c.userA.id, c.userB.id],
        messageCount: c._count.messages,
        flagged: flaggedConvIds.has(c.id),
        lastMessage: c.messages[0]?.text ?? null,
        lastMessageAt: c.lastMessageAt,
      }));
  }

  async conversationMessages(id: string) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      type: m.type,
      flagged: m.flagged,
      createdAt: m.createdAt,
    }));
  }

  async deleteConversation(id: string) {
    await this.prisma.conversation.deleteMany({ where: { id } });
    return { success: true };
  }

  // ── Matches ────────────────────────────────────────────────
  async listMatches() {
    const [total, today, recent] = await Promise.all([
      this.prisma.match.count(),
      this.prisma.match.count({ where: { createdAt: { gt: new Date(Date.now() - DAY_MS) } } }),
      this.prisma.match.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          userA: { select: { id: true, name: true } },
          userB: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      total,
      today,
      results: recent.map((m) => ({
        id: m.id,
        participants: [m.userA.name, m.userB.name],
        createdAt: m.createdAt,
      })),
    };
  }

  // ── Live activity feed ─────────────────────────────────────
  async live() {
    const now = Date.now();
    const [onlineUsers, recentMatches] = await Promise.all([
      this.prisma.user.findMany({
        where: { lastSeenAt: { gt: new Date(now - ONLINE_WINDOW_MS) } },
        select: { id: true, name: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 50,
      }),
      this.prisma.match.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { userA: { select: { name: true } }, userB: { select: { name: true } } },
      }),
    ]);
    const minuteAgo = new Date(now - 60 * 1000);
    const [messagesPerMin, matchesPerMin, regionRows] = await Promise.all([
      this.prisma.message.count({ where: { createdAt: { gt: minuteAgo } } }),
      this.prisma.match.count({ where: { createdAt: { gt: minuteAgo } } }),
      this.prisma.profile.groupBy({
        by: ['country'],
        where: { country: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { country: 'desc' } },
        take: 8,
      }),
    ]);

    return {
      onlineCount: onlineUsers.length,
      onlineUsers,
      messagesPerMin,
      matchesPerMin,
      topRegions: regionRows.map((r) => ({
        country: r.country ?? 'Unknown',
        users: r._count._all,
      })),
      recentMatches: recentMatches.map((m) => ({
        participants: [m.userA.name, m.userB.name],
        createdAt: m.createdAt,
      })),
    };
  }

  // ── Billing analytics ──────────────────────────────────────
  async billingStats() {
    const [activeSubs, premiumUsers, monthlyAgg, yearlyAgg] = await Promise.all([
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { plan: { not: 'basic' } } }),
      // Recurring monthly revenue from active subscriptions, normalized to a month.
      this.prisma.subscription.findMany({
        where: { status: 'active', plan: { interval: 'month' } },
        select: { plan: { select: { priceCents: true } } },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'active', plan: { interval: 'year' } },
        select: { plan: { select: { priceCents: true } } },
      }),
    ]);

    const mrrCents =
      monthlyAgg.reduce((s, x) => s + (x.plan?.priceCents ?? 0), 0) +
      Math.round(yearlyAgg.reduce((s, x) => s + (x.plan?.priceCents ?? 0), 0) / 12);
    const arpuCents = premiumUsers > 0 ? Math.round(mrrCents / premiumUsers) : 0;

    return { mrrCents, arpuCents, activeSubs, premiumUsers };
  }

  /// Succeeded revenue per month for the last `months` months.
  async billingRevenue(months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const txns = await this.prisma.transaction.findMany({
      where: { status: 'succeeded', createdAt: { gte: since } },
      select: { amountCents: true, createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const t of txns) {
      const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + t.amountCents);
    }
    return [...buckets.entries()].map(([month, revenueCents]) => ({ month, revenueCents }));
  }

  async transactions(limit = 50) {
    const [txns, plans] = await Promise.all([
      this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        include: { user: { select: { name: true } } },
      }),
      this.prisma.plan.findMany({ select: { id: true, name: true } }),
    ]);
    const planName = new Map(plans.map((p) => [p.id, p.name]));
    return txns.map((t) => ({
      id: t.id,
      user: t.user?.name ?? 'Unknown',
      plan: (t.planId && planName.get(t.planId)) || t.provider,
      amountCents: t.amountCents,
      currency: t.currency,
      status: t.status,
      createdAt: t.createdAt,
    }));
  }

  // ── Match analytics ────────────────────────────────────────
  async matchStats() {
    const [likes, matches, conversationsStarted] = await Promise.all([
      this.prisma.like.count({ where: { type: { in: ['like', 'superLike'] } } }),
      this.prisma.match.count(),
      this.prisma.conversation.count({ where: { messages: { some: {} } } }),
    ]);

    const successRate = likes > 0 ? Math.round((matches / likes) * 1000) / 10 : 0;
    const engagementRate = matches > 0 ? Math.round((conversationsStarted / matches) * 1000) / 10 : 0;

    return {
      total: matches,
      successRate,
      engagementRate,
      funnel: [
        { stage: 'Likes sent', count: likes },
        { stage: 'Matches', count: matches },
        { stage: 'Conversations started', count: conversationsStarted },
      ],
    };
  }

  /// Matches created per month for the last `months` months.
  async matchGrowth(months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.match.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const r of rows) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([month, count]) => ({ month, count }));
  }

  /// Messages and matches per day for the last 7 days.
  async weeklyActivity() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const [messages, matches] = await Promise.all([
      this.prisma.message.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.match.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]);

    const days: { key: string; day: string; messages: number; matches: number }[] = [];
    const keyOf = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ key: keyOf(d), day: labels[d.getDay()], messages: 0, matches: 0 });
    }
    const index = new Map(days.map((d) => [d.key, d]));
    for (const m of messages) {
      const b = index.get(keyOf(m.createdAt));
      if (b) b.messages++;
    }
    for (const m of matches) {
      const b = index.get(keyOf(m.createdAt));
      if (b) b.matches++;
    }
    return days.map(({ day, messages, matches }) => ({ day, messages, matches }));
  }
}
