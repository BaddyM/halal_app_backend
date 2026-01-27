import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DashboardModule } from './dashboard/dashboard.module';
import { FirebaseModule } from './firebase/firebase.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        CacheModule.registerAsync({
            isGlobal: true,
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const redisUrl = configService.get('REDIS_URL') || 'redis://localhost:6379';

                return {
                    stores: [createKeyv(redisUrl)],
                    ttl: 60000,
                };
            },
            inject: [ConfigService],
        }),
        JwtModule.register({
            secret: process.env.SYSTEM_SECRET,
            signOptions: { expiresIn: '30d' },
        }),
        UserModule,
        PrismaModule,
        AuthModule,
        DashboardModule,
        FirebaseModule,
        NotificationsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
