import { Module } from '@nestjs/common';
import { BillingModule } from 'src/billing/billing.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookVerifierService } from './webhook-verifier.service';

@Module({
  imports: [BillingModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookVerifierService],
})
export class WebhooksModule {}
