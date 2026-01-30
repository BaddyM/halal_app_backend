import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { SettingsService } from 'src/settings/settings.service';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: process.env.SYSTEM_SECRET,
            signOptions: { expiresIn: '30s' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, PrismaService, UserService, JwtService, SettingsService]
})
export class AuthModule { }
