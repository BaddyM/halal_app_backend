import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, MaxLength } from 'class-validator';
import { NotificationsService } from './notifications.service';

export class SendWelcomeDto {
  @IsEmail() @MaxLength(255) email!: string;
}

/// Unauthenticated because the app fires this immediately after signup, before
/// it has stored a token. NotificationsController is guarded as a whole, so
/// this route lives on its own controller.
@Controller('notifications')
export class PublicNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('send-welcome')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendWelcome(@Body() dto: SendWelcomeDto) {
    await this.notifications.sendWelcomeEmail(dto.email);
    // Same response either way: this endpoint must not reveal which addresses
    // are registered.
    return { sent: true };
  }
}
