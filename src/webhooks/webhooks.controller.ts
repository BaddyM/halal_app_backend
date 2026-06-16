import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

// Public, unauthenticated provider webhooks. With the global `/api` prefix
// these resolve to /api/public/webhooks/{stripe,apple,google-play}.
@Controller('public/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(@Body() body: any) {
    return this.webhooks.handleStripe(body);
  }

  @Post('apple')
  @HttpCode(200)
  apple(@Body() body: any) {
    return this.webhooks.handleApple(body);
  }

  @Post('google-play')
  @HttpCode(200)
  google(@Body() body: any) {
    return this.webhooks.handleGoogle(body);
  }
}
