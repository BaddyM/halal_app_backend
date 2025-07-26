import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, JwtService, PrismaService],
})
export class OrderModule {}
