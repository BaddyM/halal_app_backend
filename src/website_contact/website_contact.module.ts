import { Module } from '@nestjs/common';
import { WebsiteContactService } from './website_contact.service';
import { WebsiteContactController } from './website_contact.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
    controllers: [WebsiteContactController],
    providers: [WebsiteContactService, PrismaService, JwtService],
})
export class WebsiteContactModule { }
