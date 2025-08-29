import { Module } from '@nestjs/common';
import { WebsiteGalleryService } from './website_gallery.service';
import { WebsiteGalleryController } from './website_gallery.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
    controllers: [WebsiteGalleryController],
    providers: [WebsiteGalleryService, PrismaService, JwtService],
})
export class WebsiteGalleryModule { }
