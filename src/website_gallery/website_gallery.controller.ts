import { Controller, Get, Post, Body, Patch, Param, Delete, Res, BadRequestException, Query } from '@nestjs/common';
import { WebsiteGalleryService } from './website_gallery.service';
import { CreateWebsiteGalleryDto } from './dto/create-website_gallery.dto';
import { UpdateWebsiteGalleryDto } from './dto/update-website_gallery.dto';
import { Response } from 'express';
import { ApiQuery } from '@nestjs/swagger';

@Controller('website-gallery')
export class WebsiteGalleryController {
    constructor(private readonly websiteGalleryService: WebsiteGalleryService) { }

    @Post()
    async create(
        @Body() createWebsiteGalleryDto: CreateWebsiteGalleryDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteGalleryService.create(createWebsiteGalleryDto);
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
            const data = await this.websiteGalleryService.findAll(parseInt(currentPage), parseInt(currentLimit));
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
        @Body() updateWebsiteGalleryDto: UpdateWebsiteGalleryDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteGalleryService.update(id, updateWebsiteGalleryDto);
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
            const data = await this.websiteGalleryService.remove(id);
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
