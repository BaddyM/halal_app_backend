import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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

@Injectable()
export class CmsService {
    constructor(private readonly prisma: PrismaService) {}

    // --- Products (website fields) ---
    async listProducts(page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count(),
        ]);
        return { data, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    async updateProductWebsite(id: string, dto: UpdateProductWebsiteDto) {
        const exists = await this.prisma.product.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Product not found');
        return this.prisma.product.update({ where: { id }, data: dto });
    }

    // --- Blog ---
    async listBlog(page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.blogPost.findMany({ skip, take: limit, orderBy: { date: 'desc' } }),
            this.prisma.blogPost.count(),
        ]);
        return { data, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    getBlog(id: string) {
        return this.prisma.blogPost.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    }

    async createBlog(dto: CreateBlogDto) {
        const slugTaken = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
        if (slugTaken) throw new BadRequestException('Slug already in use');
        return this.prisma.blogPost.create({
            data: {
                slug: dto.slug,
                title: dto.title,
                excerpt: dto.excerpt || null,
                body: dto.body,
                cover: dto.cover || null,
                date: dto.date ? new Date(dto.date) : new Date(),
                author: dto.author ?? 'Jubra Editorial',
                readMinutes: dto.readMinutes ?? 5,
                isPublished: dto.isPublished ?? true,
            },
        });
    }

    async updateBlog(id: string, dto: UpdateBlogDto) {
        const post = await this.prisma.blogPost.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Blog post not found');
        const data: any = { ...dto };
        if (dto.date) data.date = new Date(dto.date);
        return this.prisma.blogPost.update({ where: { id }, data });
    }

    async deleteBlog(id: string) {
        await this.prisma.blogPost.delete({ where: { id } });
        return { success: true };
    }

    // --- Testimonials ---
    async listTestimonials() {
        return this.prisma.testimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    createTestimonial(dto: CreateTestimonialDto) {
        return this.prisma.testimonial.create({ data: dto as any });
    }
    async updateTestimonial(id: string, dto: UpdateTestimonialDto) {
        const exists = await this.prisma.testimonial.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Testimonial not found');
        return this.prisma.testimonial.update({ where: { id }, data: dto as any });
    }
    async deleteTestimonial(id: string) {
        await this.prisma.testimonial.delete({ where: { id } });
        return { success: true };
    }

    // --- FAQs ---
    async listFaqs() {
        return this.prisma.faq.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    createFaq(dto: CreateFaqDto) {
        return this.prisma.faq.create({ data: dto as any });
    }
    async updateFaq(id: string, dto: UpdateFaqDto) {
        const exists = await this.prisma.faq.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('FAQ not found');
        return this.prisma.faq.update({ where: { id }, data: dto as any });
    }
    async deleteFaq(id: string) {
        await this.prisma.faq.delete({ where: { id } });
        return { success: true };
    }

    // --- Company Values ---
    listCompanyValues() {
        return this.prisma.companyValue.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    createCompanyValue(dto: CreateCompanyValueDto) {
        return this.prisma.companyValue.create({ data: dto as any });
    }
    async updateCompanyValue(id: string, dto: UpdateCompanyValueDto) {
        const exists = await this.prisma.companyValue.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Company value not found');
        return this.prisma.companyValue.update({ where: { id }, data: dto as any });
    }
    async deleteCompanyValue(id: string) {
        await this.prisma.companyValue.delete({ where: { id } });
        return { success: true };
    }

    // --- Company Stats ---
    listCompanyStats() {
        return this.prisma.companyStat.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    createCompanyStat(dto: CreateCompanyStatDto) {
        return this.prisma.companyStat.create({ data: dto as any });
    }
    async updateCompanyStat(id: string, dto: UpdateCompanyStatDto) {
        const exists = await this.prisma.companyStat.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Company stat not found');
        return this.prisma.companyStat.update({ where: { id }, data: dto as any });
    }
    async deleteCompanyStat(id: string) {
        await this.prisma.companyStat.delete({ where: { id } });
        return { success: true };
    }

    // --- Other Services ---
    listOtherServices() {
        return this.prisma.otherService.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    createOtherService(dto: CreateOtherServiceDto) {
        return this.prisma.otherService.create({ data: dto as any });
    }
    async updateOtherService(id: string, dto: UpdateOtherServiceDto) {
        const exists = await this.prisma.otherService.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Service not found');
        return this.prisma.otherService.update({ where: { id }, data: dto as any });
    }
    async deleteOtherService(id: string) {
        await this.prisma.otherService.delete({ where: { id } });
        return { success: true };
    }

    // --- Featured Picks ---
    async listFeaturedPicks() {
        const picks = await this.prisma.featuredPick.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (picks.length === 0) return [];
        const products = await this.prisma.product.findMany({
            where: { id: { in: picks.map((p) => p.productId) } },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        return picks.map((p) => ({ ...p, product: byId.get(p.productId) || null }));
    }

    async createFeaturedPick(dto: CreateFeaturedPickDto) {
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        if (!product) throw new NotFoundException('Product not found');
        const existing = await this.prisma.featuredPick.findUnique({ where: { productId: dto.productId } });
        if (existing) throw new BadRequestException('Product is already a featured pick');
        return this.prisma.featuredPick.create({
            data: {
                productId: dto.productId,
                sortOrder: dto.sortOrder ?? 0,
                isPublished: dto.isPublished ?? true,
            },
        });
    }

    async updateFeaturedPick(id: string, dto: UpdateFeaturedPickDto) {
        const exists = await this.prisma.featuredPick.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Featured pick not found');
        if (dto.productId && dto.productId !== exists.productId) {
            const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
            if (!product) throw new NotFoundException('Product not found');
            const taken = await this.prisma.featuredPick.findUnique({ where: { productId: dto.productId } });
            if (taken && taken.id !== id) throw new BadRequestException('Product is already a featured pick');
        }
        return this.prisma.featuredPick.update({ where: { id }, data: dto as any });
    }

    async deleteFeaturedPick(id: string) {
        await this.prisma.featuredPick.delete({ where: { id } });
        return { success: true };
    }

    // --- How It Works Videos ---
    listHowItWorksVideos() {
        return this.prisma.howItWorksVideo.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    createHowItWorksVideo(dto: CreateHowItWorksVideoDto) {
        return this.prisma.howItWorksVideo.create({ data: dto as any });
    }
    async updateHowItWorksVideo(id: string, dto: UpdateHowItWorksVideoDto) {
        const exists = await this.prisma.howItWorksVideo.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Video not found');
        return this.prisma.howItWorksVideo.update({ where: { id }, data: dto as any });
    }
    async deleteHowItWorksVideo(id: string) {
        await this.prisma.howItWorksVideo.delete({ where: { id } });
        return { success: true };
    }

    // --- Site Settings ---
    async getSiteSettings() {
        const rows = await this.prisma.siteSetting.findMany();
        const out: Record<string, string> = {};
        for (const r of rows) out[r.key] = r.value;
        return out;
    }

    async upsertSiteSettings(dto: UpsertSiteSettingsDto) {
        if (!dto?.settings || typeof dto.settings !== 'object') {
            throw new BadRequestException('settings must be an object of key/value pairs');
        }
        const entries = Object.entries(dto.settings);
        await this.prisma.$transaction(
            entries.map(([key, value]) =>
                this.prisma.siteSetting.upsert({
                    where: { key },
                    create: { key, value: String(value ?? '') },
                    update: { value: String(value ?? '') },
                }),
            ),
        );
        return this.getSiteSettings();
    }

    // --- Inquiries ---
    async listInquiries(page = 1, limit = 50, status?: string, type?: string) {
        const skip = (page - 1) * limit;
        const where: any = {};
        if (status) where.status = status;
        if (type) where.type = type;
        const [data, total] = await Promise.all([
            this.prisma.websiteInquiry.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.websiteInquiry.count({ where }),
        ]);
        return { data, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    async updateInquiryStatus(id: string, dto: UpdateInquiryStatusDto) {
        const exists = await this.prisma.websiteInquiry.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Inquiry not found');
        return this.prisma.websiteInquiry.update({ where: { id }, data: { status: dto.status } });
    }
}
