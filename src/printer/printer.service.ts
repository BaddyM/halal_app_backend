// src/printer/printer.service.ts
import { Injectable } from '@nestjs/common';
const ThermalPrinter = require('node-thermal-printer');
import { PrinterDto } from './printerDto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrinterService {
    constructor(private prisma: PrismaService) { }

    async printText(paymentData: PrinterDto): Promise<any[]> {
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
                        qty:true,
                    },
                },
                service: {
                    select: {
                        service: true,
                        amount:true,
                        duration:true,
                    }
                }
            }
        });

        // let total:number = 0;

        // for (let i = 0; i < data.length; i++) {
        //     total = (total + data[i].paid);
        //     printer.tableCustom([
        //         { text: data[i].order != null ? data[i].order?.item.item : data[i].service?.service, align: "LEFT", width: 0.2 },
        //         { text: data[i].order != null ? data[i].order?.qty : data[i].service?.duration, align: "LEFT", width: 0.2 },
        //         { text: data[i].paid, align: "LEFT", width: 0.3 },
        //     ]);
        // }

        // printer.drawLine();

        // // Totals
        // printer.tableCustom([
        //     { text: "Total", align: "LEFT", width: 0.7, bold: true },
        //     { text: total, align: "LEFT", width: 0.3, bold: true },
        // ]);

        // // printer.newLine();
        // // printer.alignCenter();
        // printer.println("Thank you for coming!");
        // printer.newLine();
        // printer.cut();

        // const isConnected = await printer.isPrinterConnected();
        // console.log(isConnected);
        // if (!isConnected) {
        //     throw new Error('Printer not connected');
        // }

        // // const success = await printer.execute();
        // return success ? 'Printed successfully' : 'Print failed';
        return data;
    }
}
