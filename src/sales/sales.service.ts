import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateMultipleSaleDto, CreditSaleDto, CreditSalePaymentDto, UpdateCreditSaleDto, UpdateCreditSalePaymentDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 } from "uuid";

@Injectable()
export class SalesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createSaleDto: CreateMultipleSaleDto) {
        try {
            let data: any[] = [];
            const orderId = v4();

            for (let i = 0; i < createSaleDto.items.length; i++) {
                //Deduct from product
                let currentStock = await this.prisma.product.findFirst({
                    where: { id: createSaleDto.items[i].productId },
                    select: { totalStock: true },
                });

                let newStock = (currentStock!.totalStock - createSaleDto.items[i].quantity)

                //Update Stock
                await this.prisma.product.update({
                    where: { id: createSaleDto.items[i].productId },
                    data: { totalStock: newStock },
                });

                //Add Sales
                let sale_data = await this.prisma.sale.create({
                    data: {
                        ...createSaleDto.items[i],
                        orderId,
                    },
                    include: {
                        rep: {
                            select: {
                                id: true,
                                role: true,
                            }
                        },
                        product: {
                            select: {
                                id: true,
                            }
                        }
                    }
                });

                //Deduct from sales rep.
                if (sale_data.rep.role == "sales_rep") {
                    let current_stock_item = await this.prisma.stockTakeItem.findFirst({
                        where: {
                            userId: sale_data.rep.id,
                            productId: sale_data.product.id,
                        }
                    });

                    let new_stock_taken: number = (current_stock_item?.quantitySold ?? 0 + createSaleDto.items[i].quantity);

                    await this.prisma.stockTakeItem.update({
                        where: {
                            id: current_stock_item?.id,
                        },
                        data: {
                            quantitySold: new_stock_taken
                        }
                    });
                }

                data.push(sale_data);
            }

            //Create a sale on credit
            if (createSaleDto.items[0].onCredit) {
                const amount = data.reduce((sum, item) => (sum + (item.quantity * item.unitPrice)), 0);
                const creditSale: CreditSaleDto = {
                    orderId: data[0].orderId,
                    amount,
                    userId: data[0].repId,
                }
                await this.create_credit_sale(creditSale);
            }

            return data!;
        } catch (e) {
            console.error("Error creating sale:", e);
            throw new InternalServerErrorException({
                message: "Sorry, failed to create sale",
                error: e,
            });
        }
    }

    async findAll(page: number, limit: number, date?: string, productId?: string) {
        let dateFilter = {}

        if (date != null && date != undefined && date != "undefined" && date != "") {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            (dateFilter as any).createdAt = {
                gte: start,
                lt: end
            };
        }

        if (productId != null && productId != "" && productId != "undefined" && productId != undefined) {
            (dateFilter as any).productId = productId;
        }

        const records = await this.prisma.sale.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                rep: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                customer: true,
                product: true,
            },
            where: {
                ...dateFilter,
            },
            take: limit,
            skip: (page - 1) * limit,
        });

        // Group manually
        const grouped = records.reduce((acc, item) => {
            if (!acc[item.orderId]) {
                acc[item.orderId] = {
                    orderId: item.orderId,
                    user: item.rep,
                    product: item.product,
                    customer: item.customer,
                    memo: item.memo,
                    onCredit: item.onCredit,
                    createdAt: item.createdAt,
                    total: 0,
                    totalQuantity: 0,
                };
            }

            acc[item.orderId].total += item.unitPrice * item.quantity;
            acc[item.orderId].totalQuantity += item.quantity;

            return acc;
        }, {});

        const result = Object.values(grouped);
        return result;
    }

    async findOne(orderId: string) {
        const data = await this.prisma.sale.findMany({
            where: { orderId },
            orderBy: { createdAt: "desc" }
        });
        return data;
    }

    async update(id: string, updateSaleDto: UpdateSaleDto) {
        const data = await this.prisma.sale.update({
            where: { id },
            data: updateSaleDto,
        })
        return data;
    }

    //Credit sales
    async create_credit_sale(creditSateDto: CreditSaleDto) {
        const data = await this.prisma.creditSale.create({
            data: creditSateDto,
        });
        return data;
    }

    async fetch_credit_sale(page: number, limit: number) {
        const data = await this.prisma.creditSale.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                creditPayments: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                },
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
    }

    async update_credit_sale(id: string, updateCreditSalesDto: UpdateCreditSaleDto) {
        const data = await this.prisma.creditSale.update({
            where: { id },
            data: updateCreditSalesDto,
        });
        return data;
    }

    //Credit sale payments
    async create_credit_payment(creditSalePaymentDto: CreditSalePaymentDto) {
        //Get current orderId
        const creditSales = await this.prisma.creditSale.findMany({
            where: {
                orderId: creditSalePaymentDto.orderId,
                status: "PENDING",
            }
        });

        if (creditSales.length > 0) {
            const sales_data = await this.prisma.sale.findMany({
                where: { orderId: creditSalePaymentDto.orderId },
                select: { unitPrice: true, quantity: true }
            });

            //Fetch current paid
            let paid: number = 0;
            let total_amount: number = 0;

            for (let x = 0; x < sales_data.length; x++) {
                total_amount = (total_amount + (sales_data[x].unitPrice * sales_data[x].quantity));
            }

            for (let i = 0; i < creditSales.length; i++) {
                let paid_data = await this.prisma.creditSale.findFirst({
                    where: { id: creditSales[i].id },
                    select: {
                        creditPayments: true,
                    },
                });

                if (paid_data != null) {
                    if (paid_data?.creditPayments.length > 0) {
                        for (let k = 0; k < paid_data?.creditPayments.length; k++) {
                            paid = (paid + paid_data?.creditPayments[k].paid);
                        }
                    }
                }
            }

            //Fetch current balance
            const balance: number = (total_amount - paid);
            const newPaid: number = (paid + creditSalePaymentDto.paid);

            //Save
            if (balance >= 0 && newPaid <= total_amount) {
                const creditSaleId = await this.prisma.creditSale.findFirst({
                    where: { orderId: creditSalePaymentDto.orderId, status: "PENDING" },
                    select: { id: true }
                });

                if (creditSaleId != null) {
                    const data = await this.prisma.creditPayment.create({
                        data: {
                            creditSaleId: creditSaleId.id,
                            paid: creditSalePaymentDto.paid,
                            userId: creditSalePaymentDto.userId,
                        },
                    });

                    if (newPaid == total_amount) {
                        await this.prisma.creditSale.updateMany({
                            where: { orderId: creditSalePaymentDto.orderId },
                            data: { status: "COMPLETED" }
                        })
                    }
                    return data;
                } else {
                    return { message: "Sorry, credit sale id cannot be null.\nPlease try again later." }
                }
            } else {
                throw new InternalServerErrorException(`UGX ${creditSalePaymentDto.paid} paid is high, kindly reduce the amount being paid to UGX ${balance} inorder to complete the transaction.`);
            }
        } else {
            throw new InternalServerErrorException("This transaction was completed or is unavailable")
        }
    }

    async fetch_credit_payment(page: number, limit: number) {
        const data = await this.prisma.creditPayment.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                creditSale: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                },
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
    }

    async update_credit_payment(id: string, updateCreditPaymentDto: UpdateCreditSalePaymentDto) {
        const data = await this.prisma.creditPayment.update({
            where: { id },
            data: updateCreditPaymentDto,
        });
        return data;
    }
}
