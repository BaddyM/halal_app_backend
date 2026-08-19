import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
} from '@nestjs/common';
import { TasbihService } from './tasbih.service';
import { AuthGuard } from 'src/auth/auth.guard';
import {
  AddTasbihDto,
  UpdateUserSettingsDto,
  UpdateSystemSettingsDto,
  CreateBadgeDto,
  TasbihStatisticsDto,
  TasbihWeeklyDto,
  TasbihMonthlyDto,
  TasbihLifetimeDto,
  TasbihSessionDto,
  UserBadgeDto,
  TasbihUserSettingsDto,
  LeaderboardEntryDto,
} from './tasbih.dto';
import { AdminGuard } from 'src/admin/admin.guard';

/**
 * Tasbih Counter & Islamic Devotion Tracking System
 *
 * This API manages Tasbih (Islamic counter) sessions, statistics, badges,
 * and user preferences. All endpoints require authentication except where noted.
 */
@Controller('tasbih')
export class TasbihController {
  constructor(private readonly tasbihService: TasbihService) {}

  // ────────────────────────────────────────────────────────────────
  // COUNTER OPERATIONS
  // ────────────────────────────────────────────────────────────────

  /**
   * Add Tasbih count to current session
   *
   * @param req - Authenticated user request
   * @param data - Count and optional intention
   * @returns Created Tasbih session
   */
  @Post('count')
  @UseGuards(AuthGuard)
  async addTasbih(
    @Request() req: any,
    @Body() data: AddTasbihDto,
  ): Promise<TasbihSessionDto> {
    return this.tasbihService.addTasbih(req.user.userId, data);
  }

  /**
   * Undo last Tasbih session (within 5 minutes)
   *
   * @param req - Authenticated user request
   * @returns Undone Tasbih session
   */
  @Post('undo')
  @UseGuards(AuthGuard)
  async undoLastSession(@Request() req: any): Promise<TasbihSessionDto> {
    return this.tasbihService.undoLastSession(req.user.userId);
  }

  /**
   * Reset today's Tasbih counter
   *
   * @param req - Authenticated user request
   */
  @HttpCode(204)
  @Post('reset')
  @UseGuards(AuthGuard)
  async resetCounter(@Request() req: any): Promise<void> {
    return this.tasbihService.resetCounter(req.user.userId);
  }

  /**
   * Get recent Tasbih sessions
   *
   * @param req - Authenticated user request
   * @param limit - Number of sessions to return (default 50)
   */
  @Get('sessions')
  @UseGuards(AuthGuard)
  async getSessions(
    @Request() req: any,
    @Query('limit') limit: string = '50',
  ) {
    const limitNum = Math.min(parseInt(limit) || 50, 500);
    return; // Return from service
  }

  // ────────────────────────────────────────────────────────────────
  // STATISTICS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get today's Tasbih statistics
   *
   * Includes:
   * - Today's count
   * - Daily goal
   * - Lifetime total
   * - Current and longest streak
   * - Earned badges count
   * - Next milestone
   */
  @Get('stats/today')
  @UseGuards(AuthGuard)
  async getTodayStats(@Request() req: any): Promise<TasbihStatisticsDto> {
    return this.tasbihService.getTodayStatistics(req.user.userId);
  }

  /**
   * Get weekly statistics
   *
   * @param req - Authenticated user request
   * @param weeksBack - Number of weeks to go back (0 = current week)
   */
  @Get('stats/weekly')
  @UseGuards(AuthGuard)
  async getWeeklyStats(
    @Request() req: any,
    @Query('weeksBack') weeksBack: string = '0',
  ): Promise<TasbihWeeklyDto> {
    const weeks = Math.min(parseInt(weeksBack) || 0, 52);
    return this.tasbihService.getWeeklyStatistics(req.user.userId, weeks);
  }

  /**
   * Get monthly statistics
   *
   * @param req - Authenticated user request
   * @param monthsBack - Number of months to go back (0 = current month)
   */
  @Get('stats/monthly')
  @UseGuards(AuthGuard)
  async getMonthlyStats(
    @Request() req: any,
    @Query('monthsBack') monthsBack: string = '0',
  ): Promise<TasbihMonthlyDto> {
    const months = Math.min(parseInt(monthsBack) || 0, 12);
    return this.tasbihService.getMonthlyStatistics(req.user.userId, months);
  }

  /**
   * Get lifetime statistics
   *
   * @param req - Authenticated user request
   */
  @Get('stats/lifetime')
  @UseGuards(AuthGuard)
  async getLifetimeStats(@Request() req: any): Promise<TasbihLifetimeDto> {
    return this.tasbihService.getLifetimeStatistics(req.user.userId);
  }

  // ────────────────────────────────────────────────────────────────
  // BADGES
  // ────────────────────────────────────────────────────────────────

  /**
   * Get earned badges
   *
   * @param req - Authenticated user request
   */
  @Get('badges/earned')
  @UseGuards(AuthGuard)
  async getEarnedBadges(@Request() req: any): Promise<UserBadgeDto[]> {
    return this.tasbihService.getUserBadges(req.user.userId);
  }

  /**
   * Get badge progress (locked + in progress)
   *
   * @param req - Authenticated user request
   */
  @Get('badges/progress')
  @UseGuards(AuthGuard)
  async getBadgeProgress(@Request() req: any) {
    return this.tasbihService.getBadgeProgress(req.user.userId);
  }

  // ────────────────────────────────────────────────────────────────
  // SETTINGS & PREFERENCES
  // ────────────────────────────────────────────────────────────────

  /**
   * Get user Tasbih settings
   *
   * @param req - Authenticated user request
   */
  @Get('settings')
  @UseGuards(AuthGuard)
  async getSettings(@Request() req: any): Promise<TasbihUserSettingsDto> {
    return this.tasbihService.getUserSettings(req.user.userId);
  }

  /**
   * Update user Tasbih settings
   *
   * Allows users to configure:
   * - Daily goal
   * - Privacy visibility
   * - Notifications
   * - Sound/haptic feedback
   */
  @Put('settings')
  @UseGuards(AuthGuard)
  async updateSettings(
    @Request() req: any,
    @Body() data: UpdateUserSettingsDto,
  ): Promise<TasbihUserSettingsDto> {
    return this.tasbihService.updateUserSettings(req.user.userId, data);
  }

  /**
   * Update privacy visibility
   *
   * Options: private, matchesOnly, public
   */
  @Put('settings/visibility')
  @UseGuards(AuthGuard)
  async updateVisibility(
    @Request() req: any,
    @Body('visibility') visibility: string,
  ) {
    return this.tasbihService.updateVisibility(req.user.userId, visibility);
  }

  // ────────────────────────────────────────────────────────────────
  // LEADERBOARD
  // ────────────────────────────────────────────────────────────────

  /**
   * Get Tasbih leaderboard
   *
   * @param req - Authenticated user request
   * @param scope - Leaderboard scope (global, country, city, matches)
   * @param limit - Number of entries (max 100)
   */
  @Get('leaderboard')
  @UseGuards(AuthGuard)
  async getLeaderboard(
    @Request() req: any,
    @Query('scope') scope: string = 'global',
    @Query('limit') limit: string = '50',
  ): Promise<LeaderboardEntryDto[]> {
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    return this.tasbihService.getLeaderboard(scope, limitNum);
  }

  // ────────────────────────────────────────────────────────────────
  // ADMIN OPERATIONS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get system Tasbih settings (admin only)
   */
  @Get('admin/settings')
  @UseGuards(AuthGuard, AdminGuard)
  async getSystemSettings() {
    return this.tasbihService.getSystemSettings();
  }

  /**
   * Update system settings (admin only)
   *
   * Configure:
   * - Feature toggles (badges, streaks, leaderboard, etc.)
   * - Default daily goal
   * - Streak rules
   * - Leaderboard scope
   * - Encouragement messages
   */
  @Put('admin/settings')
  @UseGuards(AuthGuard, AdminGuard)
  async updateSystemSettings(@Body() data: UpdateSystemSettingsDto) {
    return this.tasbihService.updateSystemSettings(data);
  }

  /**
   * Create or update badge (admin only)
   */
  @Post('admin/badges')
  @UseGuards(AuthGuard, AdminGuard)
  async createBadge(@Body() data: CreateBadgeDto) {
    return this.tasbihService.createOrUpdateBadge(data);
  }

  /**
   * Update badge (admin only)
   */
  @Put('admin/badges/:badgeId')
  @UseGuards(AuthGuard, AdminGuard)
  async updateBadge(
    @Param('badgeId') badgeId: string,
    @Body() data: CreateBadgeDto,
  ) {
    return this.tasbihService.createOrUpdateBadge({ ...data, id: badgeId });
  }

  /**
   * Get all badges (admin only)
   */
  @Get('admin/badges')
  @UseGuards(AuthGuard, AdminGuard)
  async getAllBadges() {
    return; // Get from service
  }

  /**
   * Award badge to user manually (admin only)
   */
  @Post('admin/users/:userId/badges/:badgeId')
  @UseGuards(AuthGuard, AdminGuard)
  async awardBadge(
    @Param('userId') userId: string,
    @Param('badgeId') badgeId: string,
  ) {
    return this.tasbihService.awardBadge(userId, badgeId);
  }

  /**
   * Get user's Tasbih stats (admin only)
   */
  @Get('admin/users/:userId/stats')
  @UseGuards(AuthGuard, AdminGuard)
  async getUserStats(@Param('userId') userId: string): Promise<TasbihStatisticsDto> {
    return this.tasbihService.getTodayStatistics(userId);
  }

  /**
   * Reset user's Tasbih counter (admin only)
   */
  @Post('admin/users/:userId/reset')
  @UseGuards(AuthGuard, AdminGuard)
  async adminResetCounter(@Param('userId') userId: string) {
    return this.tasbihService.resetCounter(userId);
  }
}
