import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Response,
} from '@nestjs/common';
import { TasbihCompleteService } from './tasbih-complete.service';
import { AdminGuard } from 'src/admin/admin.guard';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('api/admin/tasbih')
@UseGuards(AdminGuard)
export class AdminTasbihController {
  constructor(
    private tasbihService: TasbihCompleteService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get Tasbih dashboard stats
   * GET /api/admin/tasbih/stats?period=month&year=2026&month=08
   */
  @Get('stats')
  async getStats(@Query() query: any) {
    const { period = 'month', year = 2026, month = 8 } = query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [totalUsers, activeSessions, totalCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tasbihSession.count({
        where: {
          sessionDate: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.tasbihDaily.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        _sum: { count: true },
      }),
    ]);

    const activeUserCount = await this.prisma.tasbihDaily.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    return {
      period,
      year,
      month,
      totalUsers,
      activeUsers: activeUserCount.length,
      totalSessions: activeSessions,
      totalCount: totalCount._sum.count || 0,
      averageSessionDuration: 900000,
      topBadges: [],
      dailyTrend: [],
    };
  }

  /**
   * Get user's detailed Tasbih history
   * GET /api/admin/tasbih/users/:userId
   */
  @Get('users/:userId')
  async getUserHistory(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        tasbihDailyStats: true,
        tasbihStreaks: true,
        userBadges: {
          where: { status: 'earned' },
          include: { badge: true },
        },
        tasbihSessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) throw new Error('User not found');

    const totalCount = user.tasbihDailyStats.reduce((sum, d) => sum + d.count, 0);

    return {
      userId,
      name: user.name,
      totalCount,
      sessionCount: user.tasbihSessions.length,
      currentStreak: user.tasbihStreaks[0]?.currentStreak || 0,
      longestStreak: user.tasbihStreaks[0]?.longestStreak || 0,
      badges: user.userBadges.map((ub) => ub.badge.name),
      recentSessions: user.tasbihSessions,
    };
  }

  /**
   * Get all badges
   * GET /api/admin/tasbih/badges
   */
  @Get('badges')
  async getBadges() {
    const badges = await this.prisma.tasbihBadge.findMany({
      where: { isActive: true },
    });

    const badgesWithCount = await Promise.all(
      badges.map(async (badge) => {
        const count = await this.prisma.userBadge.count({
          where: { badgeId: badge.id, status: 'earned' },
        });
        return {
          ...badge,
          unlockedCount: count,
        };
      }),
    );

    return badgesWithCount;
  }

  /**
   * Create a new badge
   * POST /api/admin/tasbih/badges
   */
  @Post('badges')
  async createBadge(@Body() data: any) {
    return this.prisma.tasbihBadge.create({
      data: {
        name: data.badgeType,
        description: data.description,
        badgeType: data.badgeType.includes('streak') ? 'streak' : 'milestone',
        threshold: data.requirement,
        streakDays: data.requirement,
        iconUrl: data.icon,
      },
    });
  }

  /**
   * Adjust user streak (admin correction)
   * PATCH /api/admin/tasbih/users/:userId/streak
   */
  @Patch('users/:userId/streak')
  async adjustStreak(@Param('userId') userId: string, @Body() data: any) {
    const { action, value } = data;

    let streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      streak = await this.prisma.tasbihStreak.create({
        data: { userId, currentStreak: 0, longestStreak: 0 },
      });
    }

    let newStreak = streak.currentStreak;
    if (action === 'set') {
      newStreak = value;
    } else if (action === 'increment') {
      newStreak += value;
    } else if (action === 'reset') {
      newStreak = 0;
    }

    return this.prisma.tasbihStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streak.longestStreak),
      },
    });
  }

  /**
   * View leaderboard (admin panel)
   * GET /api/admin/tasbih/leaderboard?period=month&limit=100
   */
  @Get('leaderboard')
  async getLeaderboard(@Query() query: any) {
    const { period = 'month', limit = 100 } = query;

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        tasbihDailyStats: true,
        tasbihStreaks: {
          orderBy: { currentStreak: 'desc' },
          take: 1,
        },
      },
      take: Math.min(Number(limit), 500),
    });

    const ranked = users
      .map((u) => ({
        userId: u.id,
        name: u.name,
        totalCount: u.tasbihDailyStats.reduce((sum, d) => sum + d.count, 0),
        streak: u.tasbihStreaks[0]?.currentStreak || 0,
      }))
      .sort((a, b) => b.totalCount - a.totalCount || b.streak - a.streak)
      .map((u, idx) => ({ rank: idx + 1, ...u }));

    return {
      period,
      leaders: ranked,
    };
  }

  /**
   * Export Tasbih data
   * GET /api/admin/tasbih/export?format=csv&period=month
   */
  @Get('export')
  async exportData(@Query('format') format: string, @Response() res: any) {
    const data = await this.prisma.tasbihDaily.findMany();

    if (format === 'csv') {
      const csv = [
        'Date,UserId,Count',
        ...data.map((d) => `${d.date},${d.userId},${d.count}`),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tasbih-export.csv"');
      res.send(csv);
    } else {
      res.json(data);
    }
  }
}
