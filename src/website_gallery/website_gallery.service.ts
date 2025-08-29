import { Injectable } from '@nestjs/common';
import { CreateWebsiteGalleryDto } from './dto/create-website_gallery.dto';
import { UpdateWebsiteGalleryDto } from './dto/update-website_gallery.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WebsiteGalleryService {
    constructor(private prisma: PrismaService) { }
    async create(createWebsiteGalleryDto: CreateWebsiteGalleryDto) {
        const data = await this.prisma.websiteGallery.create({
            data: {
                ...createWebsiteGalleryDto,
            }
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.websiteGallery.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                createdAt: "desc"
            }
        });
        return data;
    }

    async update(id: string, updateWebsiteGalleryDto: UpdateWebsiteGalleryDto) {
        const data = await this.prisma.websiteGallery.update({
            where: {
                id: id,
            },
            data: {
                ...updateWebsiteGalleryDto,
            }
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.websiteGallery.delete({
            where: {
                id: id,
            }
        });
        return data;
    }
}
