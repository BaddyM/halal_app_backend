import { Injectable } from '@nestjs/common';
import { CreateWebsiteContactDto } from './dto/create-website_contact.dto';
import { UpdateWebsiteContactDto } from './dto/update-website_contact.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WebsiteContactService {
    constructor(private prisma: PrismaService) { }
    async create(createWebsiteContactDto: CreateWebsiteContactDto) {
        const data = await this.prisma.websiteContact.create({
            data: {
                ...createWebsiteContactDto,
            }
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.websiteContact.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                createdAt: "desc"
            }
        });
        return data;
    }

    async update(id: string, updateWebsiteContactDto: UpdateWebsiteContactDto) {
        const data = await this.prisma.websiteContact.update({
            where: {
                id: id,
            },
            data: {
                ...updateWebsiteContactDto,
            }
        })
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.websiteContact.delete({
            where: {
                id: id,
            }
        });
        return data;
    }
}
