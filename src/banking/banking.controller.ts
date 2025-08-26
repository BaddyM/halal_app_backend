import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Res, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { BankingService } from './banking.service';
import { CreateBankingDto } from './dto/create-banking.dto';
import { UpdateBankingDto } from './dto/update-banking.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('banking')
export class BankingController {
    constructor(private readonly bankingService: BankingService, private prisma: PrismaService) { }

    @Post("create")
    async create(
        @Body() createBankingDto: CreateBankingDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.bankingService.create(createBankingDto);
            return res.status(200).json({
                success: true,
                message: "Cash banked successfully",
                data: data,
            });
        } catch (e) {
            throw new BadRequestException({
                success: false,
                error: `Error = ${e}`
            });
        }
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @ApiQuery({ name: "date", required: false })
    async findAll(
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Query("date") date: string,
        @Res() res: Response,
    ) {
        try {
            const start = new Date(date);
            if (isNaN(start.getTime())) throw new Error("Invalid 'from' date");
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.bankingService.findAll(parseInt(currentPage), parseInt(currentLimit), date);
            const withdraw = await this.prisma.banking.aggregate({
                _sum: {
                    amount: true,
                },
                where: {
                    type: "WITHDRAW",
                    createdAt: { gte: start, lt: end },
                }
            });
            const deposit = await this.prisma.banking.aggregate({
                _sum: {
                    amount: true,
                },
                where: {
                    type: "DEPOSIT",
                    createdAt: { gte: start, lt: end },
                }
            });
            return res.status(200).json({
                success: true,
                data: data,
                withdraw: withdraw._sum.amount,
                deposit: deposit._sum.amount,
            });
        } catch (e) {
            console.log(e);
            throw new InternalServerErrorException({
                success: false,
                error: `${e}`
            });
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateBankingDto: UpdateBankingDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.bankingService.update(id, updateBankingDto);
            return res.status(200).json({
                success: true,
                message: "Update Successfull",
                data: data,
            });
        } catch (e) {
            throw new BadRequestException({
                success: false,
                error: `Error ${e}`
            });
        }
    }

    @Delete(':id')
    async remove(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.bankingService.remove(id);
            return res.status(200).json({
                success: true,
                message: "Delete successfull",
                data: data,
            });
        } catch (e) {
            throw new BadRequestException({
                success: false,
                error: `Error ${e}`
            });
        }
    }
}
