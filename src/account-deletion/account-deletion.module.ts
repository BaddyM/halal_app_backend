import { Module } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuditInterceptor } from 'src/admin/audit.interceptor';
import { AuthModule } from 'src/auth/auth.module';
import {
  AccountDeletionController,
  MyAccountDeletionController,
} from './account-deletion.controller';
import { AdminAccountDeletionController } from './admin-account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AccountDeletionController,
    MyAccountDeletionController,
    AdminAccountDeletionController,
  ],
  providers: [AccountDeletionService, AdminGuard, AuditInterceptor],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
