import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Res, BadRequestException, Query, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Response } from 'express';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { OrderStatus, OrderType } from '@prisma/client';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('order')
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private prisma: PrismaService,
    ) { }

    @Post("create")
    async create(
        @Body() createOrderDto: CreateOrderDto,
        @Headers("authorization") authHeader: any,
        @Res() res: Response,
    ) {
        try {
            const token = authHeader.split(" ")[1];
            const userIdFromToken = await this.prisma.user.findFirst({
                where: {
                    accessToken: token,
                },
                select: {
                    id: true,
                }
            });
            const data = await this.orderService.create(createOrderDto, userIdFromToken!.id);
            if (!data) {
                throw new BadRequestException({
                    success: false,
                    message: "Table not available or Stock is Less"
                });
            } else {
                return res.status(200).json({
                    success: true,
                    data: data,
                });
            }
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: `Error = ${err}`
            });
        }
    }

    @Get("all")
    @ApiQuery({ name: "page", type: "number" })
    @ApiQuery({ name: "limit", type: "number" })
    @ApiQuery({ name: "filter", type: "string", required: false })
    @ApiQuery({ name: "status", type: "string", required: false })
    async findAll(
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Query("filter") filter: OrderType,
        @Query("status") status: OrderStatus,
        @Res() res: Response,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.orderService.findAll(parseInt(currentPage), parseInt(currentLimit), filter, status);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException();
        }
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.orderService.findOne(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException();
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.orderService.update(id, updateOrderDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException();
        }
    }

    @Delete(':id')
    async remove(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.orderService.remove(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException();
        }
    }
}
