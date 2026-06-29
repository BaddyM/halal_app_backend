import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { OAuthService } from './oauth.service';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('SYSTEM_SECRET') ?? 'dev-secret',
                signOptions: { expiresIn: '7d' },
            }),
            inject: [ConfigService],
        }),
        MailModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthGuard, OAuthService],
    exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
