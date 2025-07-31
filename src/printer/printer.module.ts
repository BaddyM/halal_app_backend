import { Module } from '@nestjs/common';
import { PrinterController } from './printer.controller';
import { PrinterService } from './printer.service';
import { PrintGateway } from './print.gateway';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PrinterController],
  providers: [PrinterService, PrintGateway, PrismaService]
})
export class PrinterModule {}
