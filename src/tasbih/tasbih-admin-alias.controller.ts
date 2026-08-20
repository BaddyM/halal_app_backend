import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { TasbihService } from './tasbih.service';
import { CreateBadgeDto, UpdateSystemSettingsDto } from './tasbih.dto';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/tasbih')
export class TasbihAdminAliasController {
  constructor(private readonly tasbih: TasbihService) {}

  @Get('settings') getSettings() { return this.tasbih.getSystemSettings(); }
  @Patch('settings') updateSettings(@Body() dto: UpdateSystemSettingsDto) { return this.tasbih.updateSystemSettings(dto); }
  @Get('badges') getBadges() { return this.tasbih.getAllBadges(); }
  @Post('badges') createBadge(@Body() dto: CreateBadgeDto) { return this.tasbih.createOrUpdateBadge(dto); }
  @Patch('badges/:id') updateBadge(@Param('id') id: string, @Body() dto: CreateBadgeDto) { return this.tasbih.createOrUpdateBadge({ ...dto, id }); }
  @Get('leaderboard') leaderboard(@Query('limit') limit = '50') { return this.tasbih.getLeaderboard('global', Math.min(Number(limit) || 50, 100)); }
  @Get('stats') stats() { return this.tasbih.getAdminStats(); }
  @Get('weekly') weekly() { return this.tasbih.getAdminWeeklyStats(); }
  @Patch('users/:userId/streak') updateStreak(@Param('userId') userId: string): Promise<unknown> { return this.tasbih.getTodayStatistics(userId); }
}
