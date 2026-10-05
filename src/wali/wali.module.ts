import { Module } from '@nestjs/common';
import { WaliService } from './wali.service';
import { WaliController } from './wali.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { MailModule } from 'src/mail/mail.module';
import { AuthModule } from 'src/auth/auth.module';

import { AdminWaliController } from './wali-admin.controller';

@Module({
  imports: [PrismaModule, RealtimeModule, MailModule, AuthModule],
  providers: [WaliService],
  controllers: [WaliController, AdminWaliController],
  exports: [WaliService],
})
export class WaliModule {}
