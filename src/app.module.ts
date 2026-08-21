import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IslamicModule } from './islamic/islamic.module';
import { BillingModule } from './billing/billing.module';
import { PushModule } from './push/push.module';
import { RealtimeModule } from './realtime/realtime.module';
import { DevicesModule } from './devices/devices.module';
import { AdsModule } from './ads/ads.module';
import { InboxModule } from './inbox/inbox.module';
import { MatchesModule } from './matches/matches.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { TasbihModule } from './tasbih/tasbih.module';
import { SupportModule } from './support/support.module';

import { WaliModule } from './wali/wali.module';

@Module({
    imports: [
        // Global request throttling to protect likes/messages and other endpoints
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 30 }] }),
        ConfigModule.forRoot({ isGlobal: true }),
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads/',
        }),
        PrismaModule,
        AuthModule,
        UsersModule,
        UploadModule,
        ChatModule,
        NotificationsModule,
        IslamicModule,
        BillingModule,
        PushModule,
        RealtimeModule,
        DevicesModule,
        AdsModule,
        InboxModule,
        MatchesModule,
        WebhooksModule,
        AdminModule,
        MailModule,
        TasbihModule,
        SupportModule,
        WaliModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule {}
