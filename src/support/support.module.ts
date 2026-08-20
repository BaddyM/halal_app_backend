import { Module } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuthModule } from 'src/auth/auth.module';
import { AiService } from 'src/chat/ai.service';
import { SupportAdminController } from './support-admin.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, AdminGuard, AiService],
})
export class SupportModule {}
