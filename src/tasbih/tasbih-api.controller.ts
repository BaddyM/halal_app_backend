import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { TasbihCompleteService } from './tasbih-complete.service';
import { AuthGuard } from 'src/auth/auth.guard';

/**
 * Tasbih (Dhikr Counter) API
 * Complete mobile and web API endpoints
 */
@Controller('tasbih')
export class TasbihApiController {
  constructor(private readonly tasbihService: TasbihCompleteService) {}

  @Post('session')
  @UseGuards(AuthGuard)
  async recordSession(@Request() req: any, @Body() data: any) {
    return this.tasbihService.startSession(req.user.id, {
      deviceId: data.idempotencyKey,
      appVersion: data.dhikrType,
    });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Request() req: any) {
    return this.tasbihService.getTodayStats(req.user.id);
  }

  // ────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ────────────────────────────────────────────────────────────────

  /**
   * Start a Tasbih session
   * POST /api/tasbih/sessions/start
   */
  @Post('sessions/start')
  @UseGuards(AuthGuard)
  async startSession(@Request() req: any, @Body() data: any) {
    return this.tasbihService.startSession(req.user.id, data);
  }

  /**
   * Record a count during session
   * POST /api/tasbih/sessions/:sessionId/record
   */
  @Post('sessions/:sessionId/record')
  @UseGuards(AuthGuard)
  async recordCount(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() data: any,
  ) {
    return this.tasbihService.recordCount(req.user.id, sessionId, data);
  }

  /**
   * End a Tasbih session
   * POST /api/tasbih/sessions/:sessionId/end
   */
  @Post('sessions/:sessionId/end')
  @UseGuards(AuthGuard)
  async endSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() data: any,
  ) {
    return this.tasbihService.endSession(req.user.id, sessionId, data);
  }

  // ────────────────────────────────────────────────────────────────
  // STATISTICS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get today's Tasbih stats
   * GET /api/tasbih/today
   */
  @Get('today')
  @UseGuards(AuthGuard)
  async getTodayStats(@Request() req: any) {
    return this.tasbihService.getTodayStats(req.user.id);
  }

  /**
   * Get period stats (month/year)
   * GET /api/tasbih/stats?period=month&year=2026&month=08
   */
  @Get('stats')
  @UseGuards(AuthGuard)
  async getPeriodStats(
    @Request() req: any,
    @Query('period') period: 'month' | 'year',
    @Query('year') year: string,
    @Query('month') month?: string,
  ) {
    return this.tasbihService.getPeriodStats(
      req.user.id,
      period,
      parseInt(year),
      month ? parseInt(month) : undefined,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // LEADERBOARD
  // ────────────────────────────────────────────────────────────────

  /**
   * Get leaderboard
   * GET /api/tasbih/leaderboard?period=week&limit=20
   * Users only see their own position; other users' scores need privacy check
   */
  @Get('leaderboard')
  @UseGuards(AuthGuard)
  async getLeaderboard(
    @Request() req: any,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasbihService.getLeaderboard(req.user.id, {
      period: (period as any) || 'week',
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // USER PROFILE TASBIH SCORE
  // ────────────────────────────────────────────────────────────────

  /**
   * Get user's public Tasbih score (for profile display)
   * GET /api/tasbih/users/:userId/score
   * Respects privacy settings and subscription
   */
  @Get('users/:userId/score')
  @UseGuards(AuthGuard)
  async getUserTasbihScore(@Request() req: any, @Param('userId') userId: string) {
    const isPremium = req.user.plan !== 'basic';
    return this.tasbihService.getUserTasbihScore(userId, req.user.id, !isPremium);
  }

  // ────────────────────────────────────────────────────────────────
  // SETTINGS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get user settings
   * GET /api/tasbih/settings
   */
  @Get('settings')
  @UseGuards(AuthGuard)
  async getSettings(@Request() req: any) {
    return this.tasbihService.getUserSettings(req.user.id);
  }

  /**
   * Update user settings
   * PATCH /api/tasbih/settings
   */
  @Post('settings')
  @UseGuards(AuthGuard)
  async updateSettings(@Request() req: any, @Body() data: any) {
    return this.tasbihService.updateUserSettings(req.user.id, data);
  }
}
