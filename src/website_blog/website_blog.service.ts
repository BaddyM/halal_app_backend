import { Injectable } from '@nestjs/common';
import { CreateWebsiteBlogDto } from './dto/create-website_blog.dto';
import { UpdateWebsiteBlogDto } from './dto/update-website_blog.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WebsiteBlogService {
    constructor(private prisma: PrismaService) { }
    async create(createWebsiteBlogDto: CreateWebsiteBlogDto) {
        const data = await this.prisma.websiteBlog.create({
            data: {
                ...createWebsiteBlogDto,
            }
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.websiteBlog.findMany({
            take: limit,
            skip: (page - 1) * limit,
            orderBy: {
                createdAt: "desc",
            },
        });
        return data;
    }

    async update(id: string, updateWebsiteBlogDto: UpdateWebsiteBlogDto) {
        const data = await this.prisma.websiteBlog.update({
            where: {
                id: id,
            },
            data: {
                ...updateWebsiteBlogDto
            }
        })
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.websiteBlog.delete({
            where: {
                id: id,
            }
        })
        return data;
    }
}
