// src/printer/printer.controller.ts
import { Controller, Post, Body, Res, InternalServerErrorException, BadRequestException, Param } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { PrinterDto } from './printerDto';
import { Response } from 'express';
import { PrintGateway } from './print.gateway';
import { ApiParam } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('printer')
export class PrinterController {
    constructor(
        private readonly printerService: PrinterService,
        private printGateway: PrintGateway,
        private prisma:PrismaService,
    ) { }

    @Post()
    async print(
        @Body() paymentData: PrinterDto,
        @Res() res: Response,
    ) {
        try {
            if (!paymentData) {
                return res.status(200).json({ message: 'No data provided' });
            }
            const message = await this.printerService.printText(paymentData);
            return res.status(200).json({ message: message });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException({
                success: false,
                error: `${err}`
            });
        }
    }

    @Post('print/:userId')
    @ApiParam({ name: "userId", type: String })
    async sendToAgent(
        @Body() dto: PrinterDto,
        @Res() res: Response,
        @Param("userId") userId: string,
    ) {
        try {
            if (userId != "") {
                const dataFromDB = await this.printerService.printText(dto);
                const printedBy = await this.prisma.user.findUnique({
                    where:{
                        id:userId,
                    },
                    select:{
                        name:true,
                    }
                });
                const data = {
                    data:dataFromDB,
                    user:printedBy?.name,
                }
                this.printGateway.sendPrintJob(data);
                return res.status(200).json({
                    success: true,
                    data:data,
                    message: "Print successfull",
                });
            } else {
                throw new BadRequestException({
                    success: false,
                    message: "UserId cannot be empty",
                });
            }
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: "Failed to print",
            });
        }
    }

}
