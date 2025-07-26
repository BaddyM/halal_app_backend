import { Injectable } from '@nestjs/common';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SalaryService {
    constructor(private prisma: PrismaService) { }

    async create(createSalaryDto: CreateSalaryDto) {
        const data = await this.prisma.salaryPayment.create({
            data: createSalaryDto,
        });
        return data;
    }

    async findAll(page: number, limit: number, from?: string, to?: string) {
        if (from != undefined && to != undefined) {
            const data = await this.prisma.salaryPayment.findMany({
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
        const data = await this.prisma.salaryPayment.findMany({
            take: limit,
            skip: (page - 1) * limit,
            include:{
                staff:{
                    select:{
                        name:true,
                        baseSalary:true,
                        payPeriod:true,
                        role:true,
                    }
                },
            }
        });
        return data;
    }

    async update(id: string, updateSalaryDto: UpdateSalaryDto) {
        const data = await this.prisma.salaryPayment.update({
            where: {
                id: id,
            },
            data: updateSalaryDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.salaryPayment.delete({
            where: {
                id: id,
            },
        });
        return data;
    }
}
