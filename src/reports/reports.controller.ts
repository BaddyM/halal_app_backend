import { Controller, Get, Post, Body, Patch, Param, Delete, Res, BadRequestException, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { Response } from 'express';
import { ApiQuery } from '@nestjs/swagger';

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Post()
    async create(
        @Body() createReportDto: CreateReportDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.reportsService.create(createReportDto);
            return res.status(200).json({
                success: true,
                data: data,
                message: "Created report successfully",
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error:${e}`
            });
        }
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    async findAll(
        @Query("page") page: any,
        @Query("limit") limit: any,
        @Res() res: Response,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 10;
            const data = await this.reportsService.findAll(parseInt(currentPage), parseInt(currentLimit));
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error:${e}`
            });
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateReportDto: UpdateReportDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.reportsService.update(id, updateReportDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error:${e}`
            });
        }
    }

    @Delete(':id')
    async remove(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.reportsService.remove(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error:${e}`
            });
        }
    }
}
