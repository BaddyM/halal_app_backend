import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Res, BadRequestException, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('staff')
export class StaffController {
    constructor(
        private readonly staffService: StaffService,
        private prisma: PrismaService,
    ) { }

    @Post()
    async create(
        @Body() createStaffDto: CreateStaffDto,
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
            const data = await this.staffService.create(userIdFromToken!.id, createStaffDto);
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
    async findAll(
        @Res() res: Response,
    ) {
        try {
            const data = await this.staffService.findAll();
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

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.staffService.findOne(id);
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
        @Body() updateStaffDto: UpdateStaffDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.staffService.update(id, updateStaffDto);
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
            const data = await this.staffService.remove(id);
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
