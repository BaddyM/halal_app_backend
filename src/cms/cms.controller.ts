import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { CmsService } from './cms.service';
import {
    CreateBlogDto,
    CreateCompanyStatDto,
    CreateCompanyValueDto,
    CreateFaqDto,
    CreateFeaturedPickDto,
    CreateHowItWorksVideoDto,
    CreateOtherServiceDto,
    CreateTestimonialDto,
    UpdateBlogDto,
    UpdateCompanyStatDto,
    UpdateCompanyValueDto,
    UpdateFaqDto,
    UpdateFeaturedPickDto,
    UpdateHowItWorksVideoDto,
    UpdateInquiryStatusDto,
    UpdateOtherServiceDto,
    UpdateProductWebsiteDto,
    UpdateTestimonialDto,
    UpsertSiteSettingsDto,
} from './dto/cms.dto';

function assertAdmin(req: any) {
    if (req?.user?.role !== 'admin') {
        throw new ForbiddenException('Admin role required');
    }
}

@ApiBearerAuth()
@ApiTags('cms')
@UseGuards(AuthGuard)
@Controller('cms')
export class CmsController {
    constructor(private readonly service: CmsService) {}

    // Products
    @Get('products')
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    listProducts(@Req() req: any, @Query('page') page = '1', @Query('limit') limit = '50') {
        assertAdmin(req);
        return this.service.listProducts(Number(page), Number(limit));
    }

    @Patch('products/:id')
    updateProduct(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProductWebsiteDto) {
        assertAdmin(req);
        return this.service.updateProductWebsite(id, dto);
    }

    // Blog
    @Get('blog')
    listBlog(@Req() req: any, @Query('page') page = '1', @Query('limit') limit = '50') {
        assertAdmin(req);
        return this.service.listBlog(Number(page), Number(limit));
    }

    @Get('blog/:id')
    getBlog(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.getBlog(id);
    }

    @Post('blog')
    createBlog(@Req() req: any, @Body() dto: CreateBlogDto) {
        assertAdmin(req);
        return this.service.createBlog(dto);
    }

    @Patch('blog/:id')
    updateBlog(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBlogDto) {
        assertAdmin(req);
        return this.service.updateBlog(id, dto);
    }

    @Delete('blog/:id')
    deleteBlog(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteBlog(id);
    }

    // Testimonials
    @Get('testimonials')
    listTestimonials(@Req() req: any) {
        assertAdmin(req);
        return this.service.listTestimonials();
    }

    @Post('testimonials')
    createTestimonial(@Req() req: any, @Body() dto: CreateTestimonialDto) {
        assertAdmin(req);
        return this.service.createTestimonial(dto);
    }

    @Patch('testimonials/:id')
    updateTestimonial(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
        assertAdmin(req);
        return this.service.updateTestimonial(id, dto);
    }

    @Delete('testimonials/:id')
    deleteTestimonial(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteTestimonial(id);
    }

    // FAQs
    @Get('faqs')
    listFaqs(@Req() req: any) {
        assertAdmin(req);
        return this.service.listFaqs();
    }

    @Post('faqs')
    createFaq(@Req() req: any, @Body() dto: CreateFaqDto) {
        assertAdmin(req);
        return this.service.createFaq(dto);
    }

    @Patch('faqs/:id')
    updateFaq(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFaqDto) {
        assertAdmin(req);
        return this.service.updateFaq(id, dto);
    }

    @Delete('faqs/:id')
    deleteFaq(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteFaq(id);
    }

    // Company values
    @Get('company-values')
    listCompanyValues(@Req() req: any) {
        assertAdmin(req);
        return this.service.listCompanyValues();
    }

    @Post('company-values')
    createCompanyValue(@Req() req: any, @Body() dto: CreateCompanyValueDto) {
        assertAdmin(req);
        return this.service.createCompanyValue(dto);
    }

    @Patch('company-values/:id')
    updateCompanyValue(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCompanyValueDto) {
        assertAdmin(req);
        return this.service.updateCompanyValue(id, dto);
    }

    @Delete('company-values/:id')
    deleteCompanyValue(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteCompanyValue(id);
    }

    // Company stats
    @Get('company-stats')
    listCompanyStats(@Req() req: any) {
        assertAdmin(req);
        return this.service.listCompanyStats();
    }

    @Post('company-stats')
    createCompanyStat(@Req() req: any, @Body() dto: CreateCompanyStatDto) {
        assertAdmin(req);
        return this.service.createCompanyStat(dto);
    }

    @Patch('company-stats/:id')
    updateCompanyStat(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCompanyStatDto) {
        assertAdmin(req);
        return this.service.updateCompanyStat(id, dto);
    }

    @Delete('company-stats/:id')
    deleteCompanyStat(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteCompanyStat(id);
    }

    // Other services
    @Get('other-services')
    listOtherServices(@Req() req: any) {
        assertAdmin(req);
        return this.service.listOtherServices();
    }

    @Post('other-services')
    createOtherService(@Req() req: any, @Body() dto: CreateOtherServiceDto) {
        assertAdmin(req);
        return this.service.createOtherService(dto);
    }

    @Patch('other-services/:id')
    updateOtherService(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateOtherServiceDto) {
        assertAdmin(req);
        return this.service.updateOtherService(id, dto);
    }

    @Delete('other-services/:id')
    deleteOtherService(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteOtherService(id);
    }

    // Featured Picks
    @Get('featured-picks')
    listFeaturedPicks(@Req() req: any) {
        assertAdmin(req);
        return this.service.listFeaturedPicks();
    }

    @Post('featured-picks')
    createFeaturedPick(@Req() req: any, @Body() dto: CreateFeaturedPickDto) {
        assertAdmin(req);
        return this.service.createFeaturedPick(dto);
    }

    @Patch('featured-picks/:id')
    updateFeaturedPick(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFeaturedPickDto) {
        assertAdmin(req);
        return this.service.updateFeaturedPick(id, dto);
    }

    @Delete('featured-picks/:id')
    deleteFeaturedPick(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteFeaturedPick(id);
    }

    // How It Works Videos
    @Get('how-it-works')
    listHowItWorksVideos(@Req() req: any) {
        assertAdmin(req);
        return this.service.listHowItWorksVideos();
    }

    @Post('how-it-works')
    createHowItWorksVideo(@Req() req: any, @Body() dto: CreateHowItWorksVideoDto) {
        assertAdmin(req);
        return this.service.createHowItWorksVideo(dto);
    }

    @Patch('how-it-works/:id')
    updateHowItWorksVideo(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateHowItWorksVideoDto) {
        assertAdmin(req);
        return this.service.updateHowItWorksVideo(id, dto);
    }

    @Delete('how-it-works/:id')
    deleteHowItWorksVideo(@Req() req: any, @Param('id') id: string) {
        assertAdmin(req);
        return this.service.deleteHowItWorksVideo(id);
    }

    // Site settings
    @Get('site-settings')
    getSiteSettings(@Req() req: any) {
        assertAdmin(req);
        return this.service.getSiteSettings();
    }

    @Put('site-settings')
    upsertSiteSettings(@Req() req: any, @Body() dto: UpsertSiteSettingsDto) {
        assertAdmin(req);
        return this.service.upsertSiteSettings(dto);
    }

    // Inquiries
    @Get('inquiries')
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'status', required: false })
    @ApiQuery({ name: 'type', required: false })
    listInquiries(
        @Req() req: any,
        @Query('page') page = '1',
        @Query('limit') limit = '50',
        @Query('status') status?: string,
        @Query('type') type?: string,
    ) {
        assertAdmin(req);
        return this.service.listInquiries(Number(page), Number(limit), status, type);
    }

    @Patch('inquiries/:id/status')
    updateInquiryStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateInquiryStatusDto) {
        assertAdmin(req);
        return this.service.updateInquiryStatus(id, dto);
    }
}
