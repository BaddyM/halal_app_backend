import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from 'src/user/user.module';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: process.env.SYSTEM_SECRET,
            signOptions: { expiresIn: '30s' },
        }),
        UserModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, PrismaService],
})
export class AuthModule { }
