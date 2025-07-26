import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, PrismaService, JwtService],
})
export class ServicesModule {}
