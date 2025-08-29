import { Controller, Get, Post, Body, Patch, Param, Delete, Res, BadRequestException, Query } from '@nestjs/common';
import { WebsiteTestimonyService } from './website_testimony.service';
import { CreateWebsiteTestimonyDto } from './dto/create-website_testimony.dto';
import { UpdateWebsiteTestimonyDto } from './dto/update-website_testimony.dto';
import { Response } from 'express';
import { ApiQuery } from '@nestjs/swagger';

@Controller('website-testimony')
export class WebsiteTestimonyController {
    constructor(private readonly websiteTestimonyService: WebsiteTestimonyService) { }

    @Post()
    async create(
        @Body() createWebsiteTestimonyDto: CreateWebsiteTestimonyDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteTestimonyService.create(createWebsiteTestimonyDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error ${e}`
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
            const data = await this.websiteTestimonyService.findAll(parseInt(currentPage), parseInt(currentLimit));
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error ${e}`
            });
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateWebsiteTestimonyDto: UpdateWebsiteTestimonyDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteTestimonyService.update(id, updateWebsiteTestimonyDto);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
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
            const data = await this.websiteTestimonyService.remove(id);
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (e) {
            console.log(e);
            throw new BadRequestException({
                success: false,
                error: `Error ${e}`
            });
        }

    }
}
