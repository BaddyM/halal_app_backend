import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { OAuthService } from './oauth.service';
import { MailModule } from '../mail/mail.module';
import { getJwtSecret } from './jwt-secret';

@Module({
    imports: [
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: getJwtSecret(config),
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
