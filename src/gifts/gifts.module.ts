import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { BillingModule } from 'src/billing/billing.module';
import { AdminGuard } from 'src/admin/admin.guard';
import { AdminGiftsController, GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [GiftsController, AdminGiftsController],
  providers: [GiftsService, AdminGuard],
})
export class GiftsModule {}