import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [SalaryController],
  providers: [SalaryService, PrismaService, JwtService],
})
export class SalaryModule {}
