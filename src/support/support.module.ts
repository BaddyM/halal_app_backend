import { Module } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuthModule } from 'src/auth/auth.module';
import { AiService } from 'src/chat/ai.service';
import { SupportAdminController } from './support-admin.controller';
import { SupportController } from './support.controller';
import { AiSupportController } from './ai-support.controller';
import { PublicSupportController } from './public-support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule],
  controllers: [
    SupportController,
    PublicSupportController,
    AiSupportController,
    SupportAdminController,
  ],
  providers: [SupportService, AdminGuard, AiService],
})
export class SupportModule {}
