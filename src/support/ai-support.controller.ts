import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { SupportService } from './support.service';

@UseGuards(AuthGuard)
@Controller('ai/support')
export class AiSupportController {
  constructor(private readonly support: SupportService) {}

  @Post('ask')
  ask(@Req() req: AuthedRequest, @Body() body: { message: string; ticketId?: string }) {
    return this.support.askAi(req.user.userId, body.message?.trim() ?? '', body.ticketId);
  }
}