import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateTargetDto, CreateTargetTransactionDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardService } from 'src/dashboard/dashboard.service';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
const dayjs = require('dayjs');

@Injectable()
export class TargetService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly dashboardService: DashboardService,
    ) { }
    async create(createTargetDto: CreateTargetDto) {
        try {
            const data = await this.prisma.target.create({
                data: { ...createTargetDto },
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async summary(userId: string) {
        const data = await this.dashboardService.mobile_summary(userId);
        return data;
    }

    async target_summary() {
        const total_saved = await this.prisma.targetTransaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                status: "APPROVED",
            }
        });

        const total_accounts = await this.prisma.target.count();

        return { total_saved: total_saved._sum.amount, total_accounts }
    }

    async findAll(page: number, limit: number) {
        try {
            const data = await this.prisma.target.findMany({
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                        }
                    },
                    transactions: true,
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async findByUser(id: string, page: number, limit: number) {
        try {
            const data = await this.prisma.target.findMany({
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                where: {
                    userId: id
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async createTransaction(body: CreateTargetTransactionDto) {
        const previous_total = await this.prisma.targetTransaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                targetId: body.targetId,
            }
        });
        const new_balance = (previous_total?._sum?.amount! + body.amount);
        const data = await this.prisma.targetTransaction.create({
            data: { ...body, balance: new_balance }
        });
        return data;
    }

    async transactions(targetId: string, page: number, limit: number) {
        try {
            const data = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                where: {
                    targetId
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async all_transactions(page: number, limit: number) {
        try {
            const data = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async all_transactions_by_user(userId: string, page: number, limit: number) {
        try {
            const data = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                where: {
                    target: {
                        userId,
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async update(id: string, updateTargetDto: UpdateTargetDto) {
        try {
            try {
                const data = await this.prisma.target.update({
                    data: {
                        ...updateTargetDto
                    },
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    },
                    where: {
                        id
                    },
                });
                return data;
            } catch (e) {
                if (process.env.MODE == "Dev") {
                    console.log("error", e);
                }
                throw new InternalServerErrorException({
                    success: false,
                    error: e,
                });
            }
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    //Statements
    async download_statement(userId: string, daysBack?: number) {
        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Critical for small Docker containers
            ],
        });

        let data: any[] = [];

        if (daysBack != undefined) {
            const startDate = dayjs().subtract(daysBack, 'day').startOf('day').toDate();
            const endDate = dayjs().endOf('day').toDate();

            const transactions = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                where: {
                    target: {
                        userId,
                    },
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: {
                    createdAt: "desc"
                }
            });

            data.push(...transactions);
        } else {
            const transactions = await this.prisma.targetTransaction.findMany({
                include: {
                    target: {
                        select: {
                            targetLabel: true,
                            amount: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    }
                },
                where: {
                    target: {
                        userId,
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            });

            data.push(...transactions);
        }

        const page = await browser.newPage();
        const logoPath = path.join(process.cwd(), 'src/assets', 'logo.png'); // works in both src/ and dist/
        const logoBase64 = fs.readFileSync(logoPath).toString('base64');
        const logoDataUri = `data:image/png;base64,${logoBase64}`;

        // Sample HTML template (could be replaced with Handlebars/EJS)
        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: block; justify-content: space-between; align-items: center; }
            .header > div:nth-child(1){
                display:flex; justify-content:center;
            }
            .header > div:nth-child(3){
                display:flex;
                justify-content:center;
            }
            .header > div:nth-child(3) > div{
                padding:10px;
                border:double 4px green;
                border-radius:10px;
                font-weight:bold;
            }
            .company { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f5f5f5; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
                <img src=${logoDataUri} alt="Logo" height="100" />
            </div>
            <div class="company">
              ${`
                <h2>Anchor Within</h2>
                <p></p>
                <p></p>
                <p></p>
            </div>
          </div>`}

          ${`
            <div
          style="display:flex; gap:3px;"
          >
            <p style="margin:0;">Reason: </p>
            <p style="margin:0; font-weight:bold;">${"Arnold's Statement"}</p>
          </div>`}

          <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Target</th>
                    <th>Amount</th>
                    <th>Transacted</th>
                    <th>Balance</th>
                    <th>Reason</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.map((item) => (
            `<tr>
                        <td>${new Date(item.createdAt).toDateString()}</td>
                        <td>${item.target.targetLabel}</td>
                        <td>${Intl.NumberFormat("en-US", { style: "currency", currency: "UGX" }).format(item.target.amount)}</td>
                        <td>${Intl.NumberFormat("en-US", { style: "currency", currency: "UGX" }).format(item.amount)}</td>
                        <td>${Intl.NumberFormat("en-US", { style: "currency", currency: "UGX" }).format(item.balance)}</td>
                        <td>${item.reason}</td>
                        <td>${item.status}</td>
                    </tr>`
        ))}
            </tbody>
          </table>

          <div
          style="display:flex; gap:10px; margin-top:10px; opacity:0.4;"
          >
            <div>Generated On: </div>
            <div>${new Date().toDateString()} at ${new Date().toLocaleTimeString()}
            </div>
        </div>
        </body>
      </html>
    `;
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
        });

        await browser.close();
        return pdfBuffer;
    }
}
