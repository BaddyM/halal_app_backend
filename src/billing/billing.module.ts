import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentsController, PesapalIpnController } from './payments.controller';
import { PaymentsAdminController } from './payments-admin.controller';
import { PesapalService } from './pesapal.service';
import { AdminGuard } from 'src/admin/admin.guard';
import { DiscountsController, AdminDiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, PaymentsController, PesapalIpnController, PaymentsAdminController, DiscountsController, AdminDiscountsController],
  providers: [BillingService, PesapalService, DiscountsService, AdminGuard],
  exports: [BillingService],
})
export class BillingModule {}
