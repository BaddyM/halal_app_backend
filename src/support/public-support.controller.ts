import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicSupportTicketDto } from './dto';
import { SupportService } from './support.service';

/// Unauthenticated help form (the marketing site's /help page). Separate from
/// SupportController because that whole controller sits behind AuthGuard.
@Controller('support')
export class PublicSupportController {
  constructor(private readonly support: SupportService) {}

  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('ticket')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePublicSupportTicketDto) {
    return this.support.createFromPublicForm(dto);
  }
}
