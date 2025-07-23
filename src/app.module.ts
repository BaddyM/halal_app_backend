import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.SYSTEM_SECRET,
      signOptions: { expiresIn: '30d' },
    }),
    UserModule, PrismaModule, AuthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
