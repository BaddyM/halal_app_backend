import { Body, Controller, HttpCode, Headers, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookVerifierService } from './webhook-verifier.service';
import { WebhooksService } from './webhooks.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

// Public provider webhooks. With the global `/api` prefix these resolve to
// /api/public/webhooks/{stripe,apple,google-play}.
//
// "Public" means unauthenticated, NOT untrusted: each handler verifies the
// provider's signature before the payload is allowed to touch billing. These
// endpoints grant paid plans, so an unverified body must never be processed.
@Controller('public/webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly verifier: WebhookVerifierService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(
    @Req() req: RawBodyRequest,
    @Body() body: any,
    @Headers('stripe-signature') signature?: string,
  ) {
    this.verifier.verifyStripe(req.rawBody, signature);
    return this.webhooks.handleStripe(body);
  }

  @Post('apple')
  @HttpCode(200)
  apple(@Body() body: any) {
    // Returns the verified payload decoded from the JWS, so the handler never
    // reads the unverified envelope.
    const verified = this.verifier.verifyApple(body);
    return this.webhooks.handleApple(verified, body);
  }

  @Post('google-play')
  @HttpCode(200)
  async google(
    @Body() body: any,
    @Query() query: any,
    @Headers('authorization') authorization?: string,
  ) {
    await this.verifier.verifyGoogle(query, authorization);
    return this.webhooks.handleGoogle(body);
  }
}
