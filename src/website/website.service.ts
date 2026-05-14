import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { ProductCategory } from '@prisma/client';

const TYPE_TO_CATEGORY: Record<string, ProductCategory> = {
    Workbook: ProductCategory.workbooks,
    Exam: ProductCategory.exams,
    'Holiday Package': ProductCategory.holiday_packages,
    workbooks: ProductCategory.workbooks,
    exams: ProductCategory.exams,
    holiday_packages: ProductCategory.holiday_packages,
};

@Injectable()
export class WebsiteService {
    constructor(private readonly prisma: PrismaService) {}

    async listProducts(args: {
        classLevel?: string;
        type?: string;
        search?: string;
        featured?: string;
        page?: string;
        limit?: string;
    }) {
        const where: any = { isPublished: true };
        if (args.classLevel) where.classLevel = args.classLevel;
        if (args.type && TYPE_TO_CATEGORY[args.type]) where.category = TYPE_TO_CATEGORY[args.type];
        if (args.featured === 'true') where.featured = true;
        if (args.search) {
            const s = args.search.trim();
            where.OR = [
                { name: { contains: s } },
                { description: { contains: s } },
                { subject: { contains: s } },
            ];
        }
        const page = Math.max(1, Number(args.page) || 1);
        const limit = Math.min(500, Math.max(1, Number(args.limit) || 24));
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: limit,
            }),
            this.prisma.product.count({ where }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        return { data, total, page, limit, totalPages, hasMore: page < totalPages };
    }

    async getProduct(id: string) {
        const product = await this.prisma.product.findFirst({
            where: { OR: [{ id }, { slug: id }], isPublished: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    listBlog() {
        return this.prisma.blogPost.findMany({
            where: { isPublished: true },
            orderBy: { date: 'desc' },
        });
    }

    async getBlogBySlug(slug: string) {
        const post = await this.prisma.blogPost.findFirst({ where: { slug, isPublished: true } });
        if (!post) throw new NotFoundException('Blog post not found');
        return post;
    }

    listTestimonials() {
        return this.prisma.testimonial.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }

    listFaqs() {
        return this.prisma.faq.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }

    listCompanyValues() {
        return this.prisma.companyValue.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }

    listCompanyStats() {
        return this.prisma.companyStat.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }

    listOtherServices() {
        return this.prisma.otherService.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }

    async listFeaturedPicks() {
        const picks = await this.prisma.featuredPick.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (picks.length === 0) return [];
        const products = await this.prisma.product.findMany({
            where: { id: { in: picks.map((p) => p.productId) }, isPublished: true },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        return picks
            .map((p) => byId.get(p.productId))
            .filter((p): p is NonNullable<typeof p> => Boolean(p));
    }

    listHowItWorksVideos() {
        return this.prisma.howItWorksVideo.findMany({
            where: { isPublished: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
    }

    async getSiteSettings() {
        const rows = await this.prisma.siteSetting.findMany();
        const out: Record<string, string> = {};
        for (const r of rows) out[r.key] = r.value;
        return out;
    }

    async submitInquiry(dto: CreateInquiryDto) {
        if (!dto.name?.trim()) throw new BadRequestException('Name is required');
        return this.prisma.websiteInquiry.create({
            data: {
                type: dto.type,
                name: dto.name.trim(),
                email: dto.email || null,
                phone: dto.phone || null,
                message: dto.message || null,
                payload: dto.payload ? JSON.stringify(dto.payload) : null,
            },
        });
    }
}
