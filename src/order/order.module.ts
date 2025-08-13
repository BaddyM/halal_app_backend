import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';

@Module({
    controllers: [OrderController],
    providers: [
        OrderService,
        JwtService,
        PrismaService,
        NotificationsService,
        NotificationsGateway,
    ],
})
export class OrderModule { }
