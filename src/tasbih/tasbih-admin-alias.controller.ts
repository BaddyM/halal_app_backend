import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { TasbihService } from './tasbih.service';
import { UpdateSystemSettingsDto } from './tasbih.dto';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/tasbih')
export class TasbihAdminAliasController {
  constructor(private readonly tasbih: TasbihService) {}

  @Get('settings')
  async getSettings() {
    const settings = await this.tasbih.getSystemSettings();
    return { ...settings, dailyGoal: settings.defaultDailyGoal };
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSystemSettingsDto & { dailyGoal?: number }) {
    const { dailyGoal, ...settings } = dto;
    return this.tasbih.updateSystemSettings({
      ...settings,
      ...(dailyGoal !== undefined && { defaultDailyGoal: dailyGoal }),
    });
  }

  @Get('badges')
  async getBadges() {
    const badges = await this.tasbih.getAllBadges();
    return badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      type: badge.badgeType === 'streak' ? 'streak' : 'count',
      threshold: badge.badgeType === 'streak' ? (badge.streakDays ?? 0) : (badge.threshold ?? 0),
      active: badge.isActive,
    }));
  }

  @Post('badges')
  createBadge(@Body() body: { name?: unknown; type?: unknown; threshold?: unknown }) {
    return this.tasbih.createDashboardBadge(body);
  }

  @Patch('badges/:id')
  updateBadge(
    @Param('id') id: string,
    @Body() body: { name?: unknown; active?: unknown; threshold?: unknown },
  ) {
    return this.tasbih.updateDashboardBadge(id, body);
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit = '50') {
    return this.tasbih.getAdminLeaderboard(Math.min(Number(limit) || 50, 100));
  }
  @Get('stats') stats() { return this.tasbih.getAdminStats(); }
  @Get('weekly') weekly() { return this.tasbih.getAdminWeeklyStats(); }
  @Patch('users/:userId/streak')
  updateStreak(
    @Param('userId') userId: string,
    @Body() data: {
      action?: 'set' | 'increment' | 'reset';
      value?: number;
      currentStreak?: number;
      reason?: string;
    },
  ) {
    const action = data.action ?? 'set';
    const value = data.currentStreak ?? data.value;
    return this.tasbih.adjustUserStreak(userId, action, value);
  }
}
