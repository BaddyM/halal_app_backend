import { Injectable } from '@nestjs/common';
import { CreateDailyReportDto } from './dto/create-daily_report.dto';
import { UpdateDailyReportDto } from './dto/update-daily_report.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DailyReportService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createDailyReportDto: CreateDailyReportDto) {
        const data = await this.prisma.dailyReport.create({
            data: createDailyReportDto,
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.dailyReport.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        })
        return data;
    }

    async update(id: string, updateDailyReportDto: UpdateDailyReportDto) {
        const data = await this.prisma.dailyReport.update({
            where:{id},
            data:updateDailyReportDto,
        })
        return data;
    }
}
