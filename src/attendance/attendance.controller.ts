import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('attendance')
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) { }

    @Post()
    async create(
        @Body() createAttendanceDto: CreateAttendanceDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.attendanceService.create(createAttendanceDto)
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
            const data = await this.attendanceService.findAll(parseInt(currentPage), parseInt(currentLimit), from, to);
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
        @Body() updateAttendanceDto: UpdateAttendanceDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.attendanceService.update(id, updateAttendanceDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                error: `Error = ${err}`,
            });
        }
    }

    @Delete(':id')
    async remove(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.attendanceService.remove(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                error: `Error = ${err}`,
            });
        }
    }
}
