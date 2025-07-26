import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Headers,
    Res,
    BadRequestException,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Response } from 'express';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('services')
export class ServicesController {
    constructor(
        private readonly servicesService: ServicesService,
        private prisma: PrismaService,
    ) { }

    @Post()
    async create(
        @Body() createServiceDto: CreateServiceDto,
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
            const data = await this.servicesService.create(userIdFromToken!.id, createServiceDto);
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
    async findAll(
        @Query("page") page: string,
        @Query("limit") limit: string,
        @Res() res: Response,
    ) {
        try {
            const currentPage = page ?? 1;
            const currentLimit = limit ?? 20;
            const data = await this.servicesService.findAll(parseInt(currentPage), parseInt(currentLimit));
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

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            const data = await this.servicesService.findOne(id);
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
        @Body() updateServiceDto: UpdateServiceDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.servicesService.update(id, updateServiceDto);
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
            const data = await this.servicesService.remove(id);
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
