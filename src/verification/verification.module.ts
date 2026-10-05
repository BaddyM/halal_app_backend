import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/admin/admin.guard';
import { VerificationController, AdminVerificationController, DashboardVerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [VerificationController, AdminVerificationController, DashboardVerificationController],
  providers: [VerificationService, AdminGuard],
})
export class VerificationModule {}