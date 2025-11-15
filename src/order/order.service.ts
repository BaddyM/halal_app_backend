import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus, OrderType } from '@prisma/client';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';

@Injectable()
export class OrderService {
    constructor(private prisma: PrismaService,
        private notifications: NotificationsGateway,
    ) { }

    async create(createOrderDto: CreateOrderDto, userId: string) {
        //Check stock
        const currentStock = await this.prisma.stock.findUnique({
            where: {
                id: createOrderDto.itemId,
            },
            select: {
                qty: true,
                item: true,
            }
        });

        //Deduct for every stock item
        const items = currentStock?.item.split("&");

        if (items) {
            for (let i = 0; i < items!.length; i++) {
                //Check subitem stock then make deduction
                const activeItem = items[i].replace(/\s+/g, '');
                const item = await this.prisma.stock.findUnique({
                    where: {
                        item: items[0].length > 1 ? activeItem : currentStock?.item,
                    },
                    select: {
                        qty: true,
                        item: true,
                        id: true,
                        subItem: true,
                    }
                });
                console.log(`ServiceLog (Item Order): ${item}`)
                if (item!.subItem != "none") {
                    const qtyOfSubItem = await this.prisma.stock.findUnique({
                        where: {
                            item: item!.subItem!.trim(),
                        },
                        select: {
                            qty: true,
                            item: true,
                            id: true,
                        }
                    });
                    const newStock = (qtyOfSubItem!.qty - createOrderDto.qty);
                    if (newStock >= 0) {
                        //Update Stock
                        await this.prisma.stock.update({
                            where: {
                                item: item!.subItem!,
                            },
                            data: {
                                qty: newStock,
                            }
                        });
                    }
                } else {
                    const newStock = (item!.qty - createOrderDto.qty);
                    if (newStock >= 0) {
                        //Update Stock
                        await this.prisma.stock.update({
                            where: {
                                id: item!.id,
                            },
                            data: {
                                qty: newStock,
                            }
                        });
                    }
                }
            }
        }

        //Create order
        const data = await this.prisma.order.create({
            data: {
                userId: userId,
                customer: createOrderDto.customer,
                itemId: createOrderDto.itemId,
                qty: createOrderDto.qty,
                table: createOrderDto.table,
                orderType: createOrderDto.orderType,
            }
        });

        //Send notification
        this.notifications.sendNotification("You have an order");
        return data;
    }

    async findAll(page: number, limit: number, date: string, filter?: OrderType, status?: OrderStatus) {
        const start = new Date(date);
        if (isNaN(start.getTime())) throw new Error("Invalid 'from' date");
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        if (filter != undefined && status != undefined) {
            const data = await this.prisma.order.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    Payment: true,
                    item: true,

                },
                where: {
                    orderType: filter,
                    createdAt: { gte: start, lt: end },
                }
            });
            return data;
        } else if (filter != undefined) {
            const data = await this.prisma.order.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    Payment: true,
                },
                where: {
                    orderType: filter,
                    createdAt: { gte: start, lt: end },
                }
            });
            return data;
        } else if (status != undefined) {
            const data = await this.prisma.order.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    Payment: true,
                },
                where: {
                    status: status,
                    createdAt: { gte: start, lt: end },
                }
            });
            return data;
        }
        const data = await this.prisma.order.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                createdAt: "desc",
            },
            include: {
                Payment: true,
            },
            where: {
                createdAt: { gte: start, lt: end },
            }
        });
        return data;
    }

    async findOne(id: string) {
        const data = await this.prisma.order.findUnique({
            where: {
                id: id,
            },
            include: {
                Payment: true,
            }
        });
        return data;
    }

    async update(id: string, updateOrderDto: UpdateOrderDto) {
        const data = await this.prisma.order.update({
            where: {
                id: id,
            },
            data: updateOrderDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.order.delete({
            where: {
                id: id,
            },
        });
        return data;
    }
}
