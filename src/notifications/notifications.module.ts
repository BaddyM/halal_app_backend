import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService,PrismaService, JwtService,],
})
export class NotificationsModule {}
