import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TasbihSession,
  TasbihDaily,
  TasbihStreak,
  UserBadge,
  TasbihUserSettings,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface TasbihCountRequest {
  count: number;
  intention?: string;
}

interface TasbihStatistics {
  todayCount: number;
  dailyGoal: number;
  lifetimeCount: number;
  currentStreak: number;
  longestStreak: number;
  graceDays: number;
  earnedBadges: number;
  nextMilestone: number;
}

interface TasbihWeeklyStats {
  week: string;
  total: number;
  days: { date: string; count: number; metGoal: boolean }[];
  avgDaily: number;
}

interface TasbihMonthlyStats {
  month: string;
  total: number;
  weeks: TasbihWeeklyStats[];
  avgDaily: number;
  consistency: number; // percentage of days with goal met
}

function timezoneDayStart(date: Date, timezone = 'UTC'): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).reduce<Record<string, number>>((result, part) => {
      if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) result[part.type] = Number(part.value);
      return result;
    }, {});
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offset = localAsUtc - date.getTime();
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offset);
  } catch {
    return startOfDay(date);
  }
}

@Injectable()
export class TasbihService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('tasbih-aggregation') private aggregationQueue: Queue,
    @InjectQueue('tasbih-badges') private badgeQueue: Queue,
    @InjectQueue('tasbih-leaderboard') private leaderboardQueue: Queue,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Counter Operations
  // ────────────────────────────────────────────────────────────────

  /**
   * Add Tasbih count with transaction support
   */
  async addTasbih(
    userId: string,
    data: TasbihCountRequest,
    timezone = 'UTC',
  ): Promise<TasbihSession> {
    // Validate input
    if (!data.count || data.count <= 0) {
      throw new BadRequestException('Count must be greater than 0');
    }
    if (data.count > 1000) {
      throw new BadRequestException('Count cannot exceed 1000 per session');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create session and aggregate in transaction
    const [session] = await this.prisma.$transaction([
      // Create session record
      this.prisma.tasbihSession.create({
        data: {
          userId,
          count: data.count,
          intention: data.intention,
          sessionDate: new Date(),
        },
      }),
    ]);

    // Queue async tasks (don't wait)
    this.aggregationQueue.add(
      'aggregate-daily',
      { userId, date: new Date(), timezone },
      { removeOnComplete: true },
    );
    this.badgeQueue.add(
      'check-badges',
      { userId },
      { removeOnComplete: true },
    );
    this.leaderboardQueue.add(
      'update-leaderboard',
      { userId },
      { removeOnComplete: true },
    );

    return session;
  }

  /**
   * Decrement/undo Tasbih count (for last session only)
   */
  async undoLastSession(userId: string): Promise<TasbihSession> {
    const lastSession = await this.prisma.tasbihSession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastSession) {
      throw new NotFoundException('No session to undo');
    }

    // Prevent undoing sessions older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (lastSession.createdAt < fiveMinutesAgo) {
      throw new BadRequestException(
        'Cannot undo sessions older than 5 minutes',
      );
    }

    // Delete and re-aggregate
    await this.prisma.$transaction([
      this.prisma.tasbihSession.delete({ where: { id: lastSession.id } }),
    ]);

    // Queue aggregation refresh
    this.aggregationQueue.add(
      'aggregate-daily',
      { userId, date: new Date() },
      { removeOnComplete: true },
    );

    return lastSession;
  }

  /**
   * Reset daily counter with confirmation
   */
  async resetCounter(userId: string, confirmCode?: string, timezone = 'UTC'): Promise<void> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete today's sessions
    const today = timezoneDayStart(new Date(), timezone);
    await this.prisma.tasbihSession.deleteMany({
      where: {
        userId,
        sessionDate: {
          gte: today,
          lt: endOfDay(new Date()),
        },
      },
    });

    // Reset daily count
    await this.prisma.tasbihDaily.update({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      data: {
        count: 0,
        metGoal: false,
      },
    });

    // Queue aggregation refresh
    this.aggregationQueue.add(
      'aggregate-daily',
      { userId, date: new Date(), timezone },
      { removeOnComplete: true },
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Daily Aggregation
  // ────────────────────────────────────────────────────────────────

  /**
   * Aggregate daily count (called by queue processor)
   */
  async aggregateDaily(userId: string, date: Date, timezone = 'UTC'): Promise<TasbihDaily> {
    const dayStart = timezoneDayStart(date, timezone);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Get user settings to check daily goal
    const settings = await this.getUserSettings(userId);

    // Sum all sessions for today
    const result = await this.prisma.tasbihSession.aggregate({
      where: {
        userId,
        sessionDate: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      _sum: { count: true },
    });

    const dailyCount = result._sum.count || 0;
    const systemSettings = await this.getSystemSettings();
    const metGoal = systemSettings.dailyGoalEnabled && dailyCount >= settings.dailyGoal;

    // Upsert daily record
    const daily = await this.prisma.tasbihDaily.upsert({
      where: {
        userId_date: {
          userId,
          date: dayStart,
        },
      },
      create: {
        userId,
        date: dayStart,
        count: dailyCount,
        metGoal,
      },
      update: {
        count: dailyCount,
        metGoal,
      },
    });

    // Update lifetime total
    await this.updateLifetimeTotal(userId);

    // Check streak
    if (metGoal) {
      await this.updateStreak(userId, true, timezone);
    }

    return daily;
  }

  /**
   * Get recent sessions for a user
   */
  async getSessions(userId: string, limit: number = 50) {
    const sessions = await this.prisma.tasbihSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return sessions.map((s) => ({ ...s, intention: s.intention ?? undefined }));
  }

  /**
   * Update lifetime total (cached in settings)
   */
  private async updateLifetimeTotal(userId: string): Promise<number> {
    const result = await this.prisma.tasbihDaily.aggregate({
      where: { userId },
      _sum: { count: true },
    });

    const total = result._sum.count || 0;

    await this.prisma.tasbihUserSettings.update({
      where: { userId },
      data: { lifetimeTotal: total },
    });

    return total;
  }

  // ────────────────────────────────────────────────────────────────
  // Streak Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Update streak on daily goal achievement
   */
  private async updateStreak(userId: string, metGoal: boolean, timezone = 'UTC'): Promise<void> {
    const systemSettings = await this.getSystemSettings();
    if (!systemSettings.streaksEnabled) return;

    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      // First time achieving goal
      await this.prisma.tasbihStreak.create({
        data: {
          userId,
          currentStreak: metGoal ? 1 : 0,
          longestStreak: metGoal ? 1 : 0,
          streakStartDate: metGoal ? new Date() : null,
        },
      });
      return;
    }

    if (metGoal) {
      // Check if streak continues (yesterday also met goal)
      const yesterday = timezoneDayStart(subDays(new Date(), 1), timezone);
      const yesterdayRecord = await this.prisma.tasbihDaily.findUnique({
        where: {
          userId_date: {
            userId,
            date: yesterday,
          },
        },
      });

      const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).format(new Date());
      let graceDaysRemaining = streak.graceMonth === currentMonth ? streak.graceDaysRemaining : 2;
      const missedYesterday = !yesterdayRecord?.metGoal && streak.currentStreak > 0;
      const canUseGrace = missedYesterday && graceDaysRemaining > 0;
      if (canUseGrace) graceDaysRemaining -= 1;
      const newStreak = yesterdayRecord?.metGoal || canUseGrace
        ? streak.currentStreak + 1
        : 1;
      const longestStreak = Math.max(newStreak, streak.longestStreak);

      await this.prisma.tasbihStreak.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak,
          streakStartDate:
            newStreak === 1 ? new Date() : streak.streakStartDate,
          streakEndDate: null,
          graceDaysRemaining,
          graceMonth: currentMonth,
        },
      });

      // Check for streak milestones
      const settings = await this.prisma.tasbihSettings.findUnique({
        where: { id: '1' }, // Singleton
      });
      if (
        settings?.badgesEnabled &&
        settings.minStreakDays &&
        newStreak === settings.minStreakDays
      ) {
        this.badgeQueue.add(
          'check-streak-badge',
          { userId, streakDays: newStreak },
          { removeOnComplete: true },
        );
      }
    } else if (streak.currentStreak > 0) {
      // Streak broken
      await this.prisma.tasbihStreak.update({
        where: { userId },
        data: {
          currentStreak: 0,
          streakEndDate: new Date(),
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Badge Management
  // ────────────────────────────────────────────────────────────────

  /**
   * Check and award badges (called by queue processor)
   */
  async checkAndAwardBadges(userId: string): Promise<UserBadge[]> {
    const systemSettings = await this.getSystemSettings();
    if (!systemSettings.badgesEnabled) return [];

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user's lifetime count and streaks
    const settings = await this.getUserSettings(userId);
    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    // Get all badges
    const badges = await this.prisma.tasbihBadge.findMany({
      where: { isActive: true },
    });

    const awardedBadges: UserBadge[] = [];

    for (const badge of badges) {
      // Check premium requirement
      if (badge.requiresPremium && user.plan === 'basic') {
        continue;
      }

      let shouldAward = false;

      switch (badge.badgeType) {
        case 'milestone':
          if (
            badge.threshold &&
            settings.lifetimeTotal >= badge.threshold
          ) {
            shouldAward = true;
          }
          break;

        case 'streak':
          if (
            badge.streakDays &&
            streak?.longestStreak &&
            streak.longestStreak >= badge.streakDays
          ) {
            shouldAward = true;
          }
          break;

        case 'consistency':
          // Award if user has been active for consecutive days
          const consistencyScore = await this.calculateConsistency(userId);
          if (badge.streakDays && consistencyScore >= badge.streakDays) {
            shouldAward = true;
          }
          break;
      }

      if (shouldAward) {
        // Check if already awarded
        const existing = await this.prisma.userBadge.findUnique({
          where: {
            userId_badgeId: {
              userId,
              badgeId: badge.id,
            },
          },
        });

        if (!existing) {
          const userBadge = await this.prisma.userBadge.create({
            data: {
              userId,
              badgeId: badge.id,
              earnedAt: new Date(),
              progress: 100,
              status: 'earned',
            },
          });
          awardedBadges.push(userBadge);
        }
      }
    }

    return awardedBadges;
  }

  /**
   * Calculate consistency score
   */
  private async calculateConsistency(userId: string): Promise<number> {
    // Get last 30 days
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    const todayEnd = endOfDay(new Date());

    const records = await this.prisma.tasbihDaily.findMany({
      where: {
        userId,
        date: {
          gte: thirtyDaysAgo,
          lte: todayEnd,
        },
      },
    });

    const goalsMetCount = records.filter((r) => r.metGoal).length;
    return Math.round((goalsMetCount / 30) * 100);
  }

  // ────────────────────────────────────────────────────────────────
  // Statistics
  // ────────────────────────────────────────────────────────────────

  /**
   * Get today's statistics
   */
  async getTodayStatistics(userId: string, timezone = 'UTC'): Promise<TasbihStatistics> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const settings = await this.getUserSettings(userId);
    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    const today = timezoneDayStart(new Date(), timezone);
    const todayStats = await this.prisma.tasbihDaily.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    const badges = await this.prisma.userBadge.findMany({
      where: {
        userId,
        status: 'earned',
      },
    });

    const nextMilestone = Math.ceil(
      (settings.lifetimeTotal + 1) / 1000,
    ) * 1000;

    return {
      todayCount: todayStats?.count || 0,
      dailyGoal: settings.dailyGoal,
      lifetimeCount: settings.lifetimeTotal,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      graceDays: streak?.graceDaysRemaining ?? 2,
      earnedBadges: badges.length,
      nextMilestone,
    };
  }

  /**
   * Get weekly statistics
   */
  async getWeeklyStatistics(
    userId: string,
    weeksBack: number = 0,
  ): Promise<TasbihWeeklyStats> {
    const weekStart = startOfWeek(
      subDays(new Date(), weeksBack * 7),
      { weekStartsOn: 1 },
    );
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const records = await this.prisma.tasbihDaily.findMany({
      where: {
        userId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    const total = records.reduce((sum, r) => sum + r.count, 0);
    const avgDaily = Math.round(total / 7);

    return {
      week: `${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`,
      total,
      days: records.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        count: r.count,
        metGoal: r.metGoal,
      })),
      avgDaily,
    };
  }

  /**
   * Get monthly statistics
   */
  async getMonthlyStatistics(
    userId: string,
    monthsBack: number = 0,
  ): Promise<TasbihMonthlyStats> {
    const today = new Date();
    const targetMonth = subDays(today, monthsBack * 30);
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);

    const records = await this.prisma.tasbihDaily.findMany({
      where: {
        userId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    const total = records.reduce((sum, r) => sum + r.count, 0);
    const goalsMetCount = records.filter((r) => r.metGoal).length;
    const consistency = Math.round(
      (goalsMetCount /
        Math.ceil(
          (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
        )) *
        100,
    );
    const avgDaily = Math.round(total / records.length) || 0;

    // Break into weeks
    const weeks: TasbihWeeklyStats[] = [];
    let weekStart = monthStart;
    while (weekStart <= monthEnd) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekRecords = records.filter(
        (r) => r.date >= weekStart && r.date <= weekEnd,
      );

      if (weekRecords.length > 0) {
        const weekTotal = weekRecords.reduce((sum, r) => sum + r.count, 0);
        weeks.push({
          week: `${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`,
          total: weekTotal,
          days: weekRecords.map((r) => ({
            date: r.date.toISOString().split('T')[0],
            count: r.count,
            metGoal: r.metGoal,
          })),
          avgDaily: Math.round(weekTotal / weekRecords.length),
        });
      }

      weekStart = new Date(weekEnd.getTime() + 1000 * 60 * 60 * 24);
    }

    return {
      month: monthStart.toISOString().substring(0, 7),
      total,
      weeks,
      avgDaily,
      consistency,
    };
  }

  /**
   * Get lifetime statistics
   */
  async getLifetimeStatistics(userId: string) {
    const settings = await this.getUserSettings(userId);
    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    const allRecords = await this.prisma.tasbihDaily.findMany({
      where: { userId },
    });

    const goalsMetCount = allRecords.filter((r) => r.metGoal).length;
    const consistencyDays = allRecords.filter((r) => r.count > 0).length;

    return {
      lifetimeTotal: settings.lifetimeTotal,
      totalDaysActive: consistencyDays,
      totalDaysMetGoal: goalsMetCount,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      badgesEarned: await this.prisma.userBadge.count({
        where: {
          userId,
          status: 'earned',
        },
      }),
      averageDailyCount:
        Math.round(
          (settings.lifetimeTotal / consistencyDays) * 100,
        ) / 100 || 0,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Settings & Preferences
  // ────────────────────────────────────────────────────────────────

  /**
   * Get or create user settings
   */
  async getUserSettings(
    userId: string,
  ): Promise<TasbihUserSettings> {
    let settings = await this.prisma.tasbihUserSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Get system defaults
      const systemSettings = await this.prisma.tasbihSettings.findUnique({
        where: { id: '1' },
      });

      settings = await this.prisma.tasbihUserSettings.create({
        data: {
          userId,
          dailyGoal: systemSettings?.defaultDailyGoal || 100,
        },
      });
    }

    return settings;
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    userId: string,
    data: Partial<TasbihUserSettings>,
  ): Promise<TasbihUserSettings> {
    // Validate
    if (data.dailyGoal !== undefined) {
      if (data.dailyGoal < 1 || data.dailyGoal > 10000) {
        throw new BadRequestException(
          'Daily goal must be between 1 and 10000',
        );
      }
    }

    return this.prisma.tasbihUserSettings.update({
      where: { userId },
      data: {
        ...data,
        userId: undefined, // Don't allow changing userId
      },
    });
  }

  /**
   * Update privacy visibility
   */
  async updateVisibility(userId: string, visibility: string) {
    if (!['private', 'matchesOnly', 'public'].includes(visibility)) {
      throw new BadRequestException('Invalid visibility setting');
    }

    return this.prisma.tasbihUserSettings.update({
      where: { userId },
      data: { visibility: visibility as any },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Badges
  // ────────────────────────────────────────────────────────────────

  /**
   * Get user's earned badges
   */
  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: {
        userId,
        status: 'earned',
      },
      include: {
        badge: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });
  }

  /**
   * Get badge progress
   */
  async getBadgeProgress(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: {
        progress: 'desc',
      },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Admin Operations
  // ────────────────────────────────────────────────────────────────

  /**
   * Create or update badge (admin)
   */
  async createOrUpdateBadge(data: any) {
    if (data.id) {
      return this.prisma.tasbihBadge.update({
        where: { id: data.id },
        data,
      });
    }

    return this.prisma.tasbihBadge.create({
      data,
    });
  }

  async createDashboardBadge(input: { name?: unknown; type?: unknown; threshold?: unknown }) {
    if (
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      !['streak', 'count'].includes(String(input.type)) ||
      !Number.isInteger(input.threshold) ||
      Number(input.threshold) < 1
    ) {
      throw new BadRequestException('Badge name, type, and positive integer threshold are required');
    }

    const streak = input.type === 'streak';
    return this.createOrUpdateBadge({
      name: input.name.trim(),
      badgeType: streak ? 'streak' : 'milestone',
      ...(streak ? { streakDays: Number(input.threshold) } : { threshold: Number(input.threshold) }),
    });
  }

  async updateDashboardBadge(
    id: string,
    input: { name?: unknown; active?: unknown; threshold?: unknown },
  ) {
    const badge = await this.prisma.tasbihBadge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundException('Badge not found');

    const data: { name?: string; isActive?: boolean; threshold?: number; streakDays?: number } = {};
    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || !input.name.trim()) {
        throw new BadRequestException('Badge name must not be empty');
      }
      data.name = input.name.trim();
    }
    if (input.active !== undefined) {
      if (typeof input.active !== 'boolean') throw new BadRequestException('Badge active must be a boolean');
      data.isActive = input.active;
    }
    if (input.threshold !== undefined) {
      if (!Number.isInteger(input.threshold) || Number(input.threshold) < 1) {
        throw new BadRequestException('Badge threshold must be a positive integer');
      }
      if (badge.badgeType === 'streak') data.streakDays = Number(input.threshold);
      else data.threshold = Number(input.threshold);
    }

    return this.prisma.tasbihBadge.update({ where: { id }, data });
  }

  /**
   * Get system settings
   */
  async getSystemSettings() {
    let settings = await this.prisma.tasbihSettings.findUnique({
      where: { id: '1' },
    });

    if (!settings) {
      settings = await this.prisma.tasbihSettings.create({
        data: {
          id: '1',
        },
      });
    }

    return settings;
  }

  async getAllBadges() {
    return this.prisma.tasbihBadge.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async getAdminStats() {
    const today = new Date();
    const [users, sessions, totals, badges, activeStreaks, dailyUsers, sessionsToday] = await Promise.all([
      this.prisma.tasbihUserSettings.count(),
      this.prisma.tasbihSession.count(),
      this.prisma.tasbihDaily.aggregate({ _sum: { count: true } }),
      this.prisma.userBadge.count({ where: { status: 'earned' } }),
      this.prisma.tasbihStreak.count({ where: { currentStreak: { gt: 0 } } }),
      this.prisma.tasbihDaily.count({ where: { date: { gte: startOfDay(subDays(today, 6)) } } }),
      this.prisma.tasbihSession.count({
        where: { sessionDate: { gte: startOfDay(today), lte: endOfDay(today) } },
      }),
    ]);
    return {
      activeStreaks,
      sessionsToday,
      badgesAwarded: badges,
      avgDailyUsers: Math.round(dailyUsers / 7),
      users,
      sessions,
      totalCount: totals._sum.count ?? 0,
      badgesEarned: badges,
    };
  }

  async getAdminWeeklyStats() {
    const today = startOfDay(new Date());
    const start = startOfDay(subDays(today, 6));
    const sessions = await this.prisma.tasbihSession.findMany({
      where: { sessionDate: { gte: start, lte: endOfDay(today) } },
      select: { userId: true, sessionDate: true },
    });
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = subDays(today, 6 - index);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toISOString().slice(0, 10),
        sessions: 0,
        users: 0,
        userIds: new Set<string>(),
      };
    });
    for (const session of sessions) {
      const index = Math.floor(
        (startOfDay(session.sessionDate).getTime() - start.getTime()) / 86_400_000,
      );
      if (index >= 0 && index < days.length) {
        days[index].sessions += 1;
        days[index].userIds.add(session.userId);
      }
    }
    return days.map(({ day, date, sessions: count, userIds }) => ({
      day,
      date,
      sessions: count,
      users: userIds.size,
    }));
  }

  async getAdminLeaderboard(limit: number) {
    const leaderboard = await this.getLeaderboard('global', limit);
    const users = await this.prisma.user.findMany({
      where: { id: { in: leaderboard.map((entry) => entry.userId) } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return leaderboard.flatMap((entry) => {
      const user = byId.get(entry.userId);
      return user
        ? [{
            userId: entry.userId,
            name: user.name,
            email: user.email,
            currentStreak: entry.currentStreak,
            totalCount: entry.lifetimeCount,
          }]
        : [];
    });
  }

  async adjustUserStreak(
    userId: string,
    action: 'set' | 'increment' | 'reset',
    value?: number,
  ) {
    if (!['set', 'increment', 'reset'].includes(action)) {
      throw new BadRequestException('Invalid streak adjustment action');
    }
    if (
      action !== 'reset' &&
      (!Number.isInteger(value) || value === undefined || value < 0)
    ) {
      throw new BadRequestException('Streak value must be a non-negative integer');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const streak = await this.prisma.tasbihStreak.upsert({
      where: { userId },
      create: { userId, currentStreak: 0, longestStreak: 0 },
      update: {},
    });
    const currentStreak =
      action === 'reset'
        ? 0
        : action === 'increment'
          ? streak.currentStreak + value!
          : value!;

    return this.prisma.tasbihStreak.update({
      where: { userId },
      data: {
        currentStreak,
        longestStreak: Math.max(currentStreak, streak.longestStreak),
      },
    });
  }

  /**
   * Update system settings (admin)
   */
  async updateSystemSettings(data: Partial<any>) {
    return this.prisma.tasbihSettings.update({
      where: { id: '1' },
      data,
    });
  }

  /**
   * Manually award badge to user
   */
  async awardBadge(userId: string, badgeId: string) {
    const badge = await this.prisma.tasbihBadge.findUnique({
      where: { id: badgeId },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    const existing = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });

    if (existing && existing.status === 'earned') {
      throw new ConflictException('User already has this badge');
    }

    if (existing) {
      return this.prisma.userBadge.update({
        where: { id: existing.id },
        data: {
          earnedAt: new Date(),
          status: 'earned',
          progress: 100,
        },
      });
    }

    return this.prisma.userBadge.create({
      data: {
        userId,
        badgeId,
        earnedAt: new Date(),
        status: 'earned',
        progress: 100,
      },
    });
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(scope: string = 'global', limit: number = 50) {
    if (limit > 100) limit = 100;
    const settings = await this.getSystemSettings();
    if (!settings.leaderboardEnabled) return [];

    return this.prisma.tasbihLeaderboard.findMany({
      where: { scope },
      orderBy: { rank: 'asc' },
      take: limit,
    });
  }
}
