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
        // const checkTableStatus = await this.prisma.order.count({
        //     where: {
        //         table: createOrderDto.table,
        //         status: {
        //             not: "SERVED"
        //         }
        //     }
        // });
        // if (checkTableStatus == 0) {
        //     const data = await this.prisma.order.create({
        //         data: {
        //             userId: userId,
        //             customer: createOrderDto.customer,
        //             items: createOrderDto.items,
        //             table: createOrderDto.table,
        //             orderType: createOrderDto.orderType,
        //         }
        //     });
        //     return data;
        // }

        //Check stock
        const currentStock = await this.prisma.stock.findUnique({
            where: {
                id: createOrderDto.itemId,
            },
            select: {
                qty: true,
            }
        });

        const newStock = (currentStock!.qty - createOrderDto.qty);
        if (newStock >= 0) {
            //Update Stock
            await this.prisma.stock.update({
                where: {
                    id: createOrderDto.itemId,
                },
                data: {
                    qty: newStock,
                }
            });

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
        return false;
    }

    async findAll(page: number, limit: number, filter?: OrderType, status?: OrderStatus) {
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
                    orderType: filter
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
                    orderType: filter
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
                    status: status
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
