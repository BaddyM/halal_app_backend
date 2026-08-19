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
  TasbihBadge,
  TasbihUserSettings,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  UserBadgeDto,
  TasbihStatisticsDto,
  TasbihWeeklyDto,
  TasbihMonthlyDto,
  TasbihLifetimeDto,
} from './tasbih.dto';

interface TasbihCountRequest {
  count: number;
  intention?: string;
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
      { userId, date: new Date() },
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
  async resetCounter(userId: string, confirmCode?: string): Promise<void> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete today's sessions
    const today = startOfDay(new Date());
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
      { userId, date: new Date() },
      { removeOnComplete: true },
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Daily Aggregation
  // ────────────────────────────────────────────────────────────────

  /**
   * Aggregate daily count (called by queue processor)
   */
  async aggregateDaily(userId: string, date: Date): Promise<TasbihDaily> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

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
    const metGoal = dailyCount >= settings.dailyGoal;

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
      await this.updateStreak(userId, true);
    }

    return daily;
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
  private async updateStreak(userId: string, metGoal: boolean): Promise<void> {
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
      const yesterday = startOfDay(subDays(new Date(), 1));
      const yesterdayRecord = await this.prisma.tasbihDaily.findUnique({
        where: {
          userId_date: {
            userId,
            date: yesterday,
          },
        },
      });

      const newStreak =
        yesterdayRecord?.metGoal ? streak.currentStreak + 1 : 1;
      const longestStreak = Math.max(newStreak, streak.longestStreak);

      await this.prisma.tasbihStreak.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak,
          streakStartDate:
            newStreak === 1 ? new Date() : streak.streakStartDate,
          streakEndDate: null,
        },
      });

      // Check for streak milestones
      const settings = await this.prisma.tasbihSettings.findUnique({
        where: { id: '1' }, // Singleton
      });
      if (settings && settings.minStreakDays && newStreak === settings.minStreakDays) {
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
  async getTodayStatistics(userId: string): Promise<TasbihStatisticsDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const settings = await this.getUserSettings(userId);
    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    const today = startOfDay(new Date());
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
  ): Promise<TasbihWeeklyDto> {
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
  ): Promise<TasbihMonthlyDto> {
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
    const weeks: TasbihWeeklyDto[] = [];
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
  async getLifetimeStatistics(userId: string): Promise<TasbihLifetimeDto> {
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
  async getUserBadges(userId: string): Promise<UserBadgeDto[]> {
    const rows = await this.prisma.userBadge.findMany({
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
    return rows.map((r) => this.toUserBadgeDto(r));
  }

  /// Flattens a UserBadge + its TasbihBadge into the wire shape the app reads.
  private toUserBadgeDto(
    row: UserBadge & { badge: TasbihBadge },
  ): UserBadgeDto {
    return {
      id: row.id,
      name: row.badge.name,
      description: row.badge.description,
      badgeType: row.badge.badgeType,
      iconUrl: row.badge.iconUrl,
      color: row.badge.color,
      earnedAt: row.earnedAt,
      progress: row.progress,
      status: row.status,
    };
  }

  /**
   * Get badge progress
   */
  async getBadgeProgress(userId: string): Promise<UserBadgeDto[]> {
    const rows = await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: {
        progress: 'desc',
      },
    });
    return rows.map((r) => this.toUserBadgeDto(r));
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

    return this.prisma.tasbihLeaderboard.findMany({
      where: { scope },
      orderBy: { rank: 'asc' },
      take: limit,
    });
  }
}
