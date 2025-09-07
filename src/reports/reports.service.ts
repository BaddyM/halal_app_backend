import { Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }
    async create(createReportDto: CreateReportDto) {
        const data = await this.prisma.reports.create({
            data: createReportDto,
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.reports.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                user: {
                    select: {
                        name: true,
                    }
                }
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
    }

    async update(id: string, updateReportDto: UpdateReportDto) {
        const data = await this.prisma.reports.update({
            where: {
                id: id,
            },
            data: updateReportDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.reports.delete({
            where: {
                id: id,
            },
        });
        return data;
    }
}
