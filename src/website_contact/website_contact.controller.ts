import { Controller, Get, Post, Body, Patch, Param, Delete, Res, BadRequestException, Query } from '@nestjs/common';
import { WebsiteContactService } from './website_contact.service';
import { CreateWebsiteContactDto } from './dto/create-website_contact.dto';
import { UpdateWebsiteContactDto } from './dto/update-website_contact.dto';
import { Response } from 'express';
import { ApiQuery } from '@nestjs/swagger';

@Controller('website-contact')
export class WebsiteContactController {
    constructor(private readonly websiteContactService: WebsiteContactService) { }

    @Post()
    async create(
        @Body() createWebsiteContactDto: CreateWebsiteContactDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteContactService.create(createWebsiteContactDto);
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
            const data = await this.websiteContactService.findAll(parseInt(currentPage), parseInt(currentLimit));
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
        @Body() updateWebsiteContactDto: UpdateWebsiteContactDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.websiteContactService.update(id, updateWebsiteContactDto);
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
            const data = await this.websiteContactService.remove(id);
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
