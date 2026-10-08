import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/admin/admin.guard';
import { LegalController } from './legal.controller';

@Module({
  imports: [AuthModule],
  controllers: [LegalController],
  providers: [AdminGuard],
})
export class LegalModule {}