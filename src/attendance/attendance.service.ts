import { Injectable } from '@nestjs/common';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AttendanceService {
    constructor(private prisma: PrismaService) { }

    async create(createAttendanceDto: CreateAttendanceDto) {
        const data = await this.prisma.attendance.create({
            data: createAttendanceDto,
        });
        return data;
    }

    async findAll(page: number, limit: number, from?: string, to?: string) {
        if (from != undefined && to != undefined) {
            const data = await this.prisma.attendance.findMany({
                take: limit,
                skip: (page - 1) * limit,
                where: {
                    createdAt: {
                        gte: new Date(from),
                        lte: new Date(to),
                    }
                }
            });
            return data;
        }
        const data = await this.prisma.attendance.findMany({
            take: limit,
            skip: (page - 1) * limit,
        });
        return data;
    }

    async update(id: string, updateAttendanceDto: UpdateAttendanceDto) {
        const data = await this.prisma.attendance.update({
            where: {
                id: id,
            },
            data: updateAttendanceDto,
        })
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.attendance.delete({
            where: {
                id: id,
            },
        })
        return data;
    }
}
