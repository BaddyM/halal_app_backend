import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderService {
    constructor(private prisma: PrismaService) { }

    async create(createOrderDto: CreateOrderDto, userId: string) {
        const data = await this.prisma.order.create({
            data: {
                userId: userId,
                customer: createOrderDto.customer,
                items: createOrderDto.items,
                table: createOrderDto.table,
            }
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.order.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                createdAt: "desc",
            },
            include:{
                Payment:true,
                KitchenOrder:true,
            }
        });
        return data;
    }

    async findOne(id: string) {
        const data = await this.prisma.order.findUnique({
            where: {
                id: id,
            },
            include:{
                Payment:true,
                KitchenOrder:true,
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
