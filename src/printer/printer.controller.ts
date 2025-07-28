// src/printer/printer.controller.ts
import { Controller, Post, Body, Res, InternalServerErrorException } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { PrinterDto } from './printerDto';
import { Response } from 'express';

@Controller('printer')
export class PrinterController {
    constructor(private readonly printerService: PrinterService) { }

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
}
