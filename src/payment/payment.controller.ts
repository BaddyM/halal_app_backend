import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, BadRequestException, Headers } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
        private prisma: PrismaService,
    ) { }

    @Post()
    async create(
        @Body() createPaymentDto: CreatePaymentDto,
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
            const data = await this.paymentService.create(userIdFromToken!.id, createPaymentDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: `Error = ${err}`
            });
        }
    }

    @Get()
    @ApiQuery({ name: "page", type: "number" })
    @ApiQuery({ name: "limit", type: "number" })
    @ApiQuery({ name: "userId", type: "string", required: false, })
    @ApiQuery({ name: "from", type: "string", required: false })
    @ApiQuery({ name: "to", type: "string", required: false })
    @ApiQuery({ name: "filter", type: "string", required: false })
    @ApiQuery({ name: "status", type: "string", required: false })
    async findAll(
        @Query("page") page: string,
        @Query("userId") userId: string,
        @Query("limit") limit: string,
        @Query("from") from: string,
        @Query("to") to: string,
        @Res() res: Response,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.paymentService.findAll(parseInt(currentPage), parseInt(currentLimit), from, to,userId);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: `Error = ${err}`
            });
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updatePaymentDto: UpdatePaymentDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.paymentService.update(id, updatePaymentDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                error: `Error = ${err}`
            });
        }
    }

    @Delete(':id')
    async remove(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.paymentService.remove(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                error: `Error = ${err}`
            });
        }
    }
}
