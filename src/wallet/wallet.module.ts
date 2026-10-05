import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/admin/admin.guard';
import { WalletController, AdminWithdrawalsController, AdminWalletSettingsController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [AuthModule],
  controllers: [WalletController, AdminWithdrawalsController, AdminWalletSettingsController],
  providers: [WalletService, AdminGuard],
})
export class WalletModule {}