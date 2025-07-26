import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Res, BadRequestException, Query, UseGuards } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Response } from 'express';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('expense')
export class ExpenseController {
    constructor(
        private readonly expenseService: ExpenseService,
        private prisma: PrismaService,
    ) { }

    @Post()
    async create(
        @Body() createExpenseDto: CreateExpenseDto,
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
            const data = await this.expenseService.create(userIdFromToken!.id, createExpenseDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: true,
                error: `Error = ${err}`
            });
        }
    }

    @Get()
    @ApiQuery({ name: "page", type: "number" })
    @ApiQuery({ name: "limit", type: "number" })
    @ApiQuery({ name: "from", type: "string", required: false, })
    @ApiQuery({ name: "to", type: "string", required: false, })
    async findAll(
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Query("from") from: string,
        @Query("to") to: string,
        @Res() res: Response,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.expenseService.findAll(parseInt(currentPage), parseInt(currentLimit), from, to);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: true,
                error: `Error = ${err}`
            });
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateExpenseDto: UpdateExpenseDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.expenseService.update(id, updateExpenseDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: true,
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
            const data = await this.expenseService.remove(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: true,
                error: `Error = ${err}`
            });
        }
    }
}
