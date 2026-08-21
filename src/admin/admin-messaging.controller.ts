import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AuditInterceptor } from './audit.interceptor';
import { AdminMessagingService } from './admin-messaging.service';
import { AdminMessageDto, BroadcastDto, SendBulkMessageDto } from './dto';

@UseGuards(AuthGuard, AdminGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin')
export class AdminMessagingController {
  constructor(private readonly messaging: AdminMessagingService) {}

  // Targeted admin → user messaging (dashboard "Messaging" tool).
  @Post('messaging')
  send(@Body() dto: SendBulkMessageDto) {
    return this.messaging.sendBulk(dto);
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
