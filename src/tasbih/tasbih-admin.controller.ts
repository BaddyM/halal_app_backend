import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Response,
  NotFoundException,
} from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuthGuard } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('admin/tasbih')
@UseGuards(AuthGuard, AdminGuard)
export class AdminTasbihController {
  constructor(private prisma: PrismaService) {}

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

    if (!user) throw new NotFoundException('User not found');

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
