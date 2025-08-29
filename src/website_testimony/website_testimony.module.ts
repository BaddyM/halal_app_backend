import { Module } from '@nestjs/common';
import { WebsiteTestimonyService } from './website_testimony.service';
import { WebsiteTestimonyController } from './website_testimony.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
    controllers: [WebsiteTestimonyController],
    providers: [WebsiteTestimonyService, PrismaService, JwtService],
})
export class WebsiteTestimonyModule { }
