import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DailyReportService } from './daily_report.service';
import { CreateDailyReportDto } from './dto/create-daily_report.dto';
import { UpdateDailyReportDto } from './dto/update-daily_report.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('daily-report')
export class DailyReportController {
    constructor(private readonly dailyReportService: DailyReportService) { }

    @Post()
    create(@Body() createDailyReportDto: CreateDailyReportDto) {
        return this.dailyReportService.create(createDailyReportDto);
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.dailyReportService.findAll(parseInt(page), parseInt(limit));
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateDailyReportDto: UpdateDailyReportDto) {
        return this.dailyReportService.update(id, updateDailyReportDto);
    }
}
