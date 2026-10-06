import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminEmailCampaignService } from './admin-email-campaign.service';
import { AdminGuard } from './admin.guard';
import { AdminMessagingService } from './admin-messaging.service';
import {
  AdminMessageDto,
  BroadcastDto,
  SendBulkMessageDto,
  SendEmailCampaignDto,
} from './dto';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminMessagingController {
  constructor(
    private readonly messaging: AdminMessagingService,
    private readonly emailCampaigns: AdminEmailCampaignService,
  ) {}

  // Targeted admin → user messaging (dashboard "Messaging" tool).
  @Post('messaging')
  send(@Body() dto: SendBulkMessageDto) {
    return this.messaging.sendBulk(dto);
  }

  @Post('email-campaigns')
  sendEmailCampaign(@Body() dto: SendEmailCampaignDto) {
    return this.emailCampaigns.send(dto);
  }

  // Broadcast announcement (dashboard "Notifications").
  @Post('notifications/broadcast')
  broadcast(@Body() dto: BroadcastDto) {
    return this.messaging.broadcast(
      dto.title,
      dto.message,
      dto.audience,
      dto.userIds,
    );
  }

  // Recent broadcast history for the dashboard "Notifications" panel.
  @Get('notifications/history')
  history() {
    return this.messaging.history();
  }

  // Live audience-size estimates for the compose form.
  @Get('notifications/audiences')
  audiences() {
    return this.messaging.audienceCounts();
  }

  // ── Admin ↔ user inbox (support chat) ──────────────────────
  @Get('inbox/threads')
  inboxThreads() {
    return this.messaging.inboxThreads();
  }

  @Get('inbox/threads/:userId')
  inboxThread(@Param('userId') userId: string) {
    return this.messaging.inboxThread(userId);
  }

  @Post('inbox/threads/:userId')
  inboxSend(@Param('userId') userId: string, @Body() dto: AdminMessageDto) {
    return this.messaging.inboxSend(userId, dto.body, dto.subject);
  }
}
