import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) {}

    @Get()
    list(@Req() req: AuthedRequest) {
        return this.notifications.list(req.user.userId);
    }

    @Get('unread-count')
    unreadCount(@Req() req: AuthedRequest) {
        return this.notifications.unreadCount(req.user.userId);
    }

    @Post('read')
    markAllRead(@Req() req: AuthedRequest) {
        return this.notifications.markAllRead(req.user.userId);
    }
}
