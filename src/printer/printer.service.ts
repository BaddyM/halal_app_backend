// src/printer/printer.service.ts
import { Injectable } from '@nestjs/common';
const ThermalPrinter = require('node-thermal-printer');
import { PrinterDto } from './printerDto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrinterService {
    constructor(private prisma: PrismaService) { }

    async printText(paymentData: PrinterDto) {
        const printer = new ThermalPrinter.printer({
            type: ThermalPrinter.types.CUSTOM, // or STAR depending on your printer
            interface: '/dev/usb/lp0', // 'tcp://xxx.xxx.xxx.xxx' for network printers
        });

        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.println("Zimbena Gardens");
        printer.setTextNormal();
        printer.drawLine();

        // Column headers
        printer.tableCustom([
            { text: "Item", align: "LEFT", width: 0.2, bold: true },
            { text: "Qty", align: "LEFT", width: 0.2, bold: true },
            { text: "Total", align: "LEFT", width: 0.3, bold: true },
        ]);

        const ids = paymentData.paymentId;

        const data = await this.prisma.payment.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            include: {
                order: {
                    select: {
                        item: true,
                        qty: true,
                    },
                },
                service: {
                    select: {
                        service: true,
                        amount: true,
                        duration: true,
                    }
                }
            }
        });
        const total = await this.prisma.payment.aggregate({
            _sum: {
                paid: true,
            },
            where: {
                id: {
                    in: ids,
                },
            },
        });
        return {
            data,
            total:total._sum.paid,
        };
    }
}
