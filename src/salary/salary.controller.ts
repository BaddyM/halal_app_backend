import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, Query, UseGuards } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('salary')
export class SalaryController {
    constructor(private readonly salaryService: SalaryService) { }

    @Post()
    async create(
        @Body() createSalaryDto: CreateSalaryDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.salaryService.create(createSalaryDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                error: `Error ${err}`,
            });
        }
    }

    @Get()
    @ApiParam({ name: "page", type: "number" })
    @ApiParam({ name: "limit", type: "number" })
    @ApiParam({ name: "from", type: "string", required: false })
    @ApiParam({ name: "to", type: "string", required: false })
    async findAll(
        @Res() res: Response,
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Query("from") from: string,
        @Query("to") to: string,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.salaryService.findAll(parseInt(currentPage), parseInt(currentLimit), from, to);
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
        @Body() updateSalaryDto: UpdateSalaryDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.salaryService.update(id, updateSalaryDto);
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
            const data = await this.salaryService.remove(id);
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
