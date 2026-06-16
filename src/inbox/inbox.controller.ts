import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { InboxService } from './inbox.service';
import { ReplyDto } from './dto';

@UseGuards(AuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.inbox.list(req.user.userId);
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthedRequest) {
    return this.inbox.unreadCount(req.user.userId);
  }

  @Get(':id')
  getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.inbox.getOne(req.user.userId, id);
  }

  @Post(':id/read')
  markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.inbox.markRead(req.user.userId, id);
  }

  @Post(':id/reply')
  reply(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.inbox.reply(req.user.userId, id, dto.body);
  }
}
