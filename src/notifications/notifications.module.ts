import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';
import { NotificationsController } from './notifications.controller';
import { PublicNotificationsController } from './public-notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
    imports: [AuthModule, MailModule],
    controllers: [NotificationsController, PublicNotificationsController],
    providers: [NotificationsService],
})
export class NotificationsModule {}
