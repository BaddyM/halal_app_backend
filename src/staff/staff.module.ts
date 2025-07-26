import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [StaffController],
  providers: [StaffService, PrismaService, JwtService],
})
export class StaffModule {}
