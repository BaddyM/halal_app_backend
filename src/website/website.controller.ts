import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { WebsiteService } from './website.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';

@ApiTags('website')
@Controller('website')
export class WebsiteController {
    constructor(private readonly service: WebsiteService) {}

    @Get('products')
    @ApiQuery({ name: 'classLevel', required: false })
    @ApiQuery({ name: 'type', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'featured', required: false })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    listProducts(
        @Query('classLevel') classLevel?: string,
        @Query('type') type?: string,
        @Query('search') search?: string,
        @Query('featured') featured?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.service.listProducts({ classLevel, type, search, featured, page, limit });
    }

    @Get('products/:id')
    getProduct(@Param('id') id: string) {
        return this.service.getProduct(id);
    }

    @Get('blog')
    listBlog() {
        return this.service.listBlog();
    }

    @Get('blog/:slug')
    getBlog(@Param('slug') slug: string) {
        return this.service.getBlogBySlug(slug);
    }

    @Get('testimonials')
    listTestimonials() {
        return this.service.listTestimonials();
    }

    @Get('faqs')
    listFaqs() {
        return this.service.listFaqs();
    }

    @Get('company-values')
    listCompanyValues() {
        return this.service.listCompanyValues();
    }

    @Get('company-stats')
    listCompanyStats() {
        return this.service.listCompanyStats();
    }

    @Get('other-services')
    listOtherServices() {
        return this.service.listOtherServices();
    }

    @Get('featured-picks')
    listFeaturedPicks() {
        return this.service.listFeaturedPicks();
    }

    @Get('how-it-works')
    listHowItWorksVideos() {
        return this.service.listHowItWorksVideos();
    }

    @Get('site-settings')
    getSiteSettings() {
        return this.service.getSiteSettings();
    }

    @Post('inquiries')
    submitInquiry(@Body() dto: CreateInquiryDto) {
        return this.service.submitInquiry(dto);
    }
}
