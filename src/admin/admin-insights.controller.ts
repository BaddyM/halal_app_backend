import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { AdminGuard } from './admin.guard';
import { AdminInsightsService } from './admin-insights.service';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminInsightsController {
  constructor(
    private readonly insights: AdminInsightsService,
    private readonly bus: RealtimeBus,
  ) {}

  // ── Stats + analytics ──────────────────────────────────────
  @Get('stats')
  stats() {
    return this.insights.stats();
  }

  @Get('analytics/growth')
  growth() {
    return this.insights.userGrowth();
  }

  @Get('analytics/gender')
  gender() {
    return this.insights.genderRatio();
  }

  @Get('analytics/practice')
  practice() {
    return this.insights.practiceBreakdown();
  }

  @Get('analytics/activity')
  activity() {
    return this.insights.activity();
  }

  @Get('analytics/weekly-activity')
  weeklyActivity() {
    return this.insights.weeklyActivity();
  }

  // ── Billing analytics ──────────────────────────────────────
  @Get('billing/stats')
  billingStats() {
    return this.insights.billingStats();
  }

  @Get('billing/revenue')
  billingRevenue() {
    return this.insights.billingRevenue();
  }

  @Get('billing/transactions')
  transactions() {
    return this.insights.transactions();
  }

  // ── Match analytics ────────────────────────────────────────
  @Get('matches/stats')
  matchStats() {
    return this.insights.matchStats();
  }

  @Get('analytics/match-growth')
  matchGrowth() {
    return this.insights.matchGrowth();
  }

  // ── Audit logs ─────────────────────────────────────────────
  @Get('logs')
  logs() {
    return this.insights.logs();
  }

  // ── App settings ───────────────────────────────────────────
  @Get('settings')
  getSettings() {
    return this.insights.getSettings();
  }

  @Patch('settings')
  patchSettings(@Body() body: Record<string, unknown>) {
    return this.insights.patchSettings(body);
  }

  // ── Conversations (moderation) ─────────────────────────────
  @Get('conversations')
  conversations(@Query('flagged') flagged?: string) {
    return this.insights.listConversations(flagged === 'true');
  }

  @Get('conversations/:id/messages')
  conversationMessages(@Param('id') id: string) {
    return this.insights.conversationMessages(id);
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string) {
    return this.insights.deleteConversation(id);
  }

  // ── Matches + live ─────────────────────────────────────────
  @Get('matches')
  matches() {
    return this.insights.listMatches();
  }

  @Get('live')
  live() {
    return this.insights.live();
  }

  /// Backlog of recent live-feed events (newest first). The realtime stream is
  /// over the `/admin` socket namespace (`admin:event`); this seeds initial load.
  @Get('live/events')
  liveEvents() {
    return this.bus.recentAdminEvents();
  }
}
