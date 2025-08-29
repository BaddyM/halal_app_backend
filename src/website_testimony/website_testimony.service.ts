import { Injectable } from '@nestjs/common';
import { CreateWebsiteTestimonyDto } from './dto/create-website_testimony.dto';
import { UpdateWebsiteTestimonyDto } from './dto/update-website_testimony.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WebsiteTestimonyService {
    constructor(private prisma: PrismaService) { }
    async create(createWebsiteTestimonyDto: CreateWebsiteTestimonyDto) {
        const data = await this.prisma.websiteTestimonies.create({
            data: {
                ...createWebsiteTestimonyDto,
            },
        })
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.websiteTestimonies.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                createdAt: "desc",
            }
        });
        return data;
    }

    async update(id: string, updateWebsiteTestimonyDto: UpdateWebsiteTestimonyDto) {
        const data = await this.prisma.websiteTestimonies.update({
            where: {
                id: id,
            },
            data: {
                ...updateWebsiteTestimonyDto,
            }
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.websiteTestimonies.delete({
            where: {
                id: id,
            }
        });
        return data;
    }
}
