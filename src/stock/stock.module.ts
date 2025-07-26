import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [StockController],
  providers: [StockService, JwtService, PrismaService],
})
export class StockModule {}
