import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { CreateSupportTicketDto, ReplySupportTicketDto } from './dto';
import { SupportService } from './support.service';

@UseGuards(AuthGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Req() req: AuthedRequest) { return this.support.listForUser(req.user.userId); }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSupportTicketDto) {
    return this.support.create(req.user.userId, dto);
  }

  @Get('ticket')
  listTicketAlias(@Req() req: AuthedRequest) {
    return this.support.listForUser(req.user.userId);
  }

  @Post('ticket')
  createTicketAlias(@Req() req: AuthedRequest, @Body() dto: CreateSupportTicketDto) {
    return this.support.create(req.user.userId, dto);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.support.getForUser(req.user.userId, id);
  }

  @Post(':id/replies')
  reply(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: ReplySupportTicketDto) {
    return this.support.replyForUser(req.user.userId, id, dto);
  }

  @Post('ai')
  askAi(@Req() req: AuthedRequest, @Body() body: { message: string; ticketId?: string }) {
    return this.support.askAi(req.user.userId, body.message?.trim() ?? '', body.ticketId);
  }

}
