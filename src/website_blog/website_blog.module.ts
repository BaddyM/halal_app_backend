import { Module } from '@nestjs/common';
import { WebsiteBlogService } from './website_blog.service';
import { WebsiteBlogController } from './website_blog.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
    controllers: [WebsiteBlogController],
    providers: [WebsiteBlogService, PrismaService, JwtService],
})
export class WebsiteBlogModule { }
