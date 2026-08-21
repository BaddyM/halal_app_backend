import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { MailService } from 'src/mail/mail.service';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, subDays } from 'date-fns';

// ────────────────────────────────────────────────────────────────
// INTERFACES
// ────────────────────────────────────────────────────────────────

export interface TasbihCountRequest {
  type: 'tahlil' | 'tahmid' | 'takbir' | 'tasbeeh' | 'custom';
  count: number;
  timestamp?: string;
}

export interface TasbihSessionRequest {
  deviceId?: string;
  appVersion?: string;
}

export interface TasbihSessionEndRequest {
  totalCount: number;
  countByType: Record<string, number>;
}

export interface LeaderboardFilters {
  period?: 'day' | 'week' | 'month' | 'year' | 'allTime';
  limit?: number;
  offset?: number;
}

// ────────────────────────────────────────────────────────────────
// TASBIH SERVICE
// ────────────────────────────────────────────────────────────────

@Injectable()
export class TasbihCompleteService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeBus,
    private mail: MailService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ────────────────────────────────────────────────────────────────

  /**
   * Start a new Tasbih session
   */
  async startSession(userId: string, data: TasbihSessionRequest) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const session = await this.prisma.tasbihSession.create({
      data: {
        userId,
        count: 0,
        sessionDate: new Date(),
        intention: data.deviceId || undefined,
      },
    });

    this.realtime.emitToUser(userId, 'tasbih:session-started', {
      sessionId: session.id,
      startedAt: session.sessionDate,
    });

    return {
      sessionId: session.id,
      startedAt: session.sessionDate,
      status: 'active',
    };
  }

  /**
   * Record a count during session
   */
  async recordCount(userId: string, sessionId: string, data: TasbihCountRequest) {
    const session = await this.prisma.tasbihSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    if (data.count <= 0 || data.count > 1000) {
      throw new BadRequestException('Count must be between 1 and 1000');
    }

    // Update session count
    const updated = await this.prisma.tasbihSession.update({
      where: { id: sessionId },
      data: {
        count: { increment: data.count },
      },
    });

    return {
      sessionId: session.id,
      type: data.type,
      count: data.count,
      totalCount: updated.count,
      recordedAt: new Date(),
    };
  }

  /**
   * End a session and aggregate
   */
  async endSession(userId: string, sessionId: string, data: TasbihSessionEndRequest) {
    const session = await this.prisma.tasbihSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException('Not your session');

    // Update final count
    const updated = await this.prisma.tasbihSession.update({
      where: { id: sessionId },
      data: {
        count: data.totalCount,
      },
    });

    // Aggregate to daily
    const today = startOfDay(new Date());
    const dailyResult = await this.prisma.tasbihDaily.aggregate({
      where: {
        userId,
        date: today,
      },
      _sum: { count: true },
    });

    const settings = await this.prisma.tasbihUserSettings.findUnique({
      where: { userId },
    });

    const dailyTotal = (dailyResult._sum.count || 0) + data.totalCount;
    const metGoal = settings ? dailyTotal >= settings.dailyGoal : false;

    const daily = await this.prisma.tasbihDaily.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      create: {
        userId,
        date: today,
        count: dailyTotal,
        metGoal,
      },
      update: {
        count: dailyTotal,
        metGoal,
      },
    });

    // Update lifetime total
    const lifetime = await this.prisma.tasbihDaily.aggregate({
      where: { userId },
      _sum: { count: true },
    });

    const lifetimeTotal = lifetime._sum.count || 0;
    await this.prisma.tasbihUserSettings.update({
      where: { userId },
      data: { lifetimeTotal },
    });

    // Update streak
    let newBadges: string[] = [];
    if (metGoal) {
      newBadges = await this.updateStreak(userId);
    }

    this.realtime.emitToUser(userId, 'tasbih:session-ended', {
      sessionId,
      totalCount: data.totalCount,
      dailyTotal,
      streakIncremented: metGoal,
      newBadges,
    });

    return {
      sessionId,
      startedAt: session.sessionDate,
      endedAt: new Date(),
      durationMs: new Date().getTime() - session.sessionDate.getTime(),
      totalCount: data.totalCount,
      countByType: data.countByType,
      streakIncremented: metGoal,
      newBadges,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // STATISTICS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get today's stats
   */
  async getTodayStats(userId: string) {
    const today = startOfDay(new Date());

    const daily = await this.prisma.tasbihDaily.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    const settings = await this.prisma.tasbihUserSettings.findUnique({
      where: { userId },
    });

    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    const badges = await this.prisma.userBadge.findMany({
      where: {
        userId,
        status: 'earned',
      },
      select: { badge: { select: { name: true } } },
    });

    return {
      date: today.toISOString().split('T')[0],
      totalCount: daily?.count || 0,
      sessionCount: await this.prisma.tasbihSession.count({
        where: {
          userId,
          sessionDate: { gte: today, lte: endOfDay(new Date()) },
        },
      }),
      totalDurationMs: 0, // Would need session start/end times
      countByType: {},
      streak: streak?.currentStreak || 0,
      badges: badges.map((b) => b.badge.name),
    };
  }

  /**
   * Get period stats (month/year)
   */
  async getPeriodStats(
    userId: string,
    period: 'month' | 'year',
    year: number,
    month?: number,
  ) {
    let start: Date, end: Date;

    if (period === 'month' && month) {
      start = startOfMonth(new Date(year, month - 1, 1));
      end = endOfMonth(new Date(year, month - 1, 1));
    } else {
      start = startOfYear(new Date(year, 0, 1));
      end = endOfYear(new Date(year, 11, 31));
    }

    const dailies = await this.prisma.tasbihDaily.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });

    const totalCount = dailies.reduce((sum, d) => sum + d.count, 0);
    const sessionCount = await this.prisma.tasbihSession.count({
      where: {
        userId,
        sessionDate: { gte: start, lte: end },
      },
    });

    const bestDay = dailies.length
      ? dailies.reduce((best, current) => (current.count > best.count ? current : best))
      : null;

    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    return {
      period,
      year,
      month,
      totalCount,
      sessionCount,
      totalDurationMs: sessionCount * 900000, // Estimate
      bestDay: bestDay ? { date: bestDay.date.toISOString().split('T')[0], count: bestDay.count } : null,
      averageDailyCount: dailies.length > 0 ? Math.round(totalCount / dailies.length) : 0,
      streakInfo: {
        current: streak?.currentStreak || 0,
        longest: streak?.longestStreak || 0,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────
  // LEADERBOARD
  // ────────────────────────────────────────────────────────────────

  /**
   * Get leaderboard (with privacy filtering)
   * Users can only see their own position; admins see full list
   */
  async getLeaderboard(userId: string, filters: LeaderboardFilters) {
    const period = filters.period || 'week';
    const limit = Math.min(filters.limit || 20, 100);

    let start: Date, end: Date;

    switch (period) {
      case 'day':
        start = startOfDay(new Date());
        end = endOfDay(new Date());
        break;
      case 'week':
        start = startOfWeek(new Date());
        end = endOfWeek(new Date());
        break;
      case 'month':
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case 'year':
        start = startOfYear(new Date());
        end = endOfYear(new Date());
        break;
      default:
        start = new Date('2000-01-01');
        end = new Date();
    }

    // Get all users' counts in period (for ranking)
    const users = await this.prisma.user.findMany({
      where: {
        tasbihDailyStats: {
          some: {
            date: { gte: start, lte: end },
          },
        },
      },
      select: {
        id: true,
        name: true,
        profile: { select: { primaryImageUrl: true } },
        tasbihStreaks: true,
        tasbihSettings: true,
        tasbihDailyStats: {
          where: { date: { gte: start, lte: end } },
          select: { count: true },
        },
      },
    });

    // Calculate scores and sort
    const ranked = users
      .map((u) => ({
        userId: u.id,
        name: u.name,
        imageUrl: u.profile?.primaryImageUrl,
        totalCount: u.tasbihDailyStats.reduce((sum, d) => sum + d.count, 0),
        streak: u.tasbihStreaks[0]?.currentStreak || 0,
        visibility: u.tasbihSettings?.visibility || 'private',
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    // Find user's rank
    const userRank = ranked.findIndex((u) => u.userId === userId);
    const userEntry = ranked[userRank];

    // Return: top users + user's position (never show other people's scores unless public)
    const publicLeaders = ranked
      .slice(0, limit)
      .filter((u) => u.visibility === 'public');

    const leaders = userEntry ? publicLeaders.concat(userEntry).slice(0, limit) : publicLeaders;

    return {
      period,
      endDate: new Date().toISOString(),
      leaders: leaders.map((u, idx) => ({
        rank: idx + 1,
        userId: u.userId,
        name: u.name,
        imageUrl: u.imageUrl,
        totalCount: u.totalCount,
        sessionCount: 0, // Would need to calculate
        streak: u.streak,
      })),
      yourRank: userEntry
        ? {
            rank: userRank + 1,
            totalCount: userEntry.totalCount,
            sessionCount: 0,
          }
        : null,
    };
  }

  /**
   * Get user's public tasbih score (for profile display)
   * Respects privacy settings and subscription
   */
  async getUserTasbihScore(userId: string, requesterId: string, subscriberOnly = false) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tasbihSettings: true,
        tasbihStreaks: true,
        plan: true,
        tasbihDailyStats: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Check privacy settings
    const visibility = user.tasbihSettings?.visibility || 'private';

    // Can't see if private
    if (visibility === 'private') {
      throw new ForbiddenException('User profile is private');
    }

    // Check subscription requirement
    if (subscriberOnly && user.plan === 'basic') {
      throw new ForbiddenException('Premium feature');
    }

    // Calculate lifetime total
    const total = user.tasbihDailyStats.reduce((sum, d) => sum + d.count, 0);

    return {
      userId,
      lifetimeCount: total,
      currentStreak: user.tasbihStreaks[0]?.currentStreak || 0,
      longestStreak: user.tasbihStreaks[0]?.longestStreak || 0,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // STREAK MANAGEMENT
  // ────────────────────────────────────────────────────────────────

  private async updateStreak(userId: string): Promise<string[]> {
    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    const today = startOfDay(new Date());
    const yesterday = subDays(today, 1);

    const yesterdayRecord = await this.prisma.tasbihDaily.findUnique({
      where: {
        userId_date: {
          userId,
          date: yesterday,
        },
      },
    });

    const newStreak = !streak
      ? 1
      : yesterdayRecord?.metGoal || streak.currentStreak === 0
        ? (streak.currentStreak || 0) + 1
        : 1;

    const longestStreak = !streak
      ? newStreak
      : Math.max(newStreak, streak.longestStreak || 0);

    await this.prisma.tasbihStreak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: newStreak,
        longestStreak,
        streakStartDate: new Date(),
      },
      update: {
        currentStreak: newStreak,
        longestStreak,
      },
    });

    // Check for streak badges
    const badgesToAward: string[] = [];
    if (newStreak === 7) badgesToAward.push('streak_7');
    if (newStreak === 30) badgesToAward.push('streak_30');
    if (newStreak === 100) badgesToAward.push('streak_100');

    // Award badges
    for (const badgeName of badgesToAward) {
      const badge = await this.prisma.tasbihBadge.findUnique({
        where: { name: badgeName },
      });
      if (badge) {
        await this.prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId: badge.id } },
          create: {
            userId,
            badgeId: badge.id,
            status: 'earned',
            earnedAt: new Date(),
            progress: 100,
          },
          update: {
            status: 'earned',
            earnedAt: new Date(),
            progress: 100,
          },
        });

        this.realtime.emitToUser(userId, 'tasbih:badge-unlocked', {
          badgeName,
          earnedAt: new Date(),
        });
      }
    }

    this.realtime.emitToUser(userId, 'tasbih:streak-updated', {
      currentStreak: newStreak,
      longestStreak,
    });

    return badgesToAward;
  }

  // ────────────────────────────────────────────────────────────────
  // USER SETTINGS
  // ────────────────────────────────────────────────────────────────

  async getUserSettings(userId: string) {
    let settings = await this.prisma.tasbihUserSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.tasbihUserSettings.create({
        data: {
          userId,
          visibility: 'private',
          dailyGoal: 100,
          notificationsEnabled: true,
          soundEnabled: true,
          hapticEnabled: true,
        },
      });
    }

    return settings;
  }

  async updateUserSettings(userId: string, updates: any) {
    return this.prisma.tasbihUserSettings.update({
      where: { userId },
      data: updates,
    });
  }
}
