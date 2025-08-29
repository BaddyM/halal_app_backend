import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, BadRequestException } from '@nestjs/common';
import { WebsiteBlogService } from './website_blog.service';
import { CreateWebsiteBlogDto } from './dto/create-website_blog.dto';
import { UpdateWebsiteBlogDto } from './dto/update-website_blog.dto';
import { ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';

@Controller('website-blog')
export class WebsiteBlogController {
    constructor(private readonly websiteBlogService: WebsiteBlogService) { }

    @Post()
    async create(
        @Body() createWebsiteBlogDto: CreateWebsiteBlogDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteBlogService.create(createWebsiteBlogDto);
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
            const data = await this.websiteBlogService.findAll(parseInt(currentPage), parseInt(currentLimit))
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
        @Body() updateWebsiteBlogDto: UpdateWebsiteBlogDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteBlogService.update(id, updateWebsiteBlogDto);
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
            const data = await this.websiteBlogService.remove(id);
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
