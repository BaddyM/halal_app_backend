import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Headers, Res, BadRequestException, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { Response } from 'express';
import { StockCategory } from '@prisma/client';
import { TopupStock } from 'src/order/dto/create-order.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('stock')
export class StockController {
    constructor(
        private readonly stockService: StockService,
        private prisma: PrismaService,
    ) { }

    @Get('list')
    async findStockList(
        @Res() res: Response,
    ) {
        try {
            const data = await this.stockService.stockList();
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

    @Post("create")
    async create(
        @Body() createStockDto: CreateStockDto,
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
            const data = await this.stockService.create(createStockDto, userIdFromToken!.id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: "User not Authorized",
            });
        }
    }

    @Get()
    @ApiQuery({ name: "page", type: Number })
    @ApiQuery({ name: "limit", type: Number })
    @ApiQuery({ name: "category", required: false, })
    async findAll(
        @Res() res: Response,
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Query("category") category?: StockCategory,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.stockService.findAll(parseInt(currentPage), parseInt(currentLimit), category);
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

    @Post("topup")
    async topupStock(
        @Body() topup: TopupStock,
        @Res() res: Response,
    ) {
        try {
            const data = await this.stockService.topUpStock(topup.itemId, topup.qty);
            if (!data) {
                throw new BadRequestException({
                    success: false,
                    message: `Failed to topup`,
                });
            }
            return res.status(200).json({
                success: true,
                message: "Topup successfull"
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: `Error = ${err}`,
            });
        }
    }

    @Get("topupHistory")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    async getTopupHistory(
        @Res() res: Response,
        @Query("page") page: string,
        @Query("limit") limit: string,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.stockService.topupHistory(parseInt(currentPage), parseInt(currentLimit));
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: `Error = ${err}`,
            });
        }
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.stockService.findOne(id);
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

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateStockDto: UpdateStockDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.stockService.update(id, updateStockDto);
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
            const data = await this.stockService.remove(id);
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
