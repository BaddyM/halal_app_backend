import { Injectable } from '@nestjs/common';
import { CreateSalaryDto, CreateStaffDto, UpdateSalaryDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StaffService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createStaffDto: CreateStaffDto) {
        const data = await this.prisma.staff.create({
            data: createStaffDto,
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.staff.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        });
        const total = await this.prisma.staff.count();
        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
    }

    async update(id: string, updateStaffDto: UpdateStaffDto) {
        const data = await this.prisma.staff.update({
            where: { id },
            data: updateStaffDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.staff.delete({
            where: { id },
        });
        return data;
    }

    //Salary
    async create_salary(createSalaryDto: CreateSalaryDto) {
        const data = await this.prisma.salary.create({
            data: createSalaryDto,
        });
        return data;
    }

    async fetch_salary(page: number, limit: number, period?: string, staffId?: string) {
        let filter: any = {}
        const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];

        const current_month: number = new Date().getMonth();
        const current_year: number = new Date().getFullYear();
        const month: string = String(months[current_month]).toUpperCase();
        const current_period: string = `${month}-${current_year}`;

        //Filter by period
        if (period != null && period != undefined && period != "undefined" && period != "") {
            filter.period = period;
        } else {
            filter.period = current_period;
        }

        //Filter by staff
        if (staffId != null && staffId != undefined && staffId != "undefined" && staffId != "") {
            filter.staffId = staffId;
        }

        const data = await this.prisma.salary.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            where: {
                ...filter,
            }
        });

        const total = await this.prisma.salary.count({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            where: {
                ...filter,
            }
        });

        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
    }

    async update_salary(id: string, updateSalaryDto: UpdateSalaryDto) {
        const data = await this.prisma.salary.update({
            where: { id },
            data: updateSalaryDto,
        });
        return data;
    }

    async delete_salary(id: string) {
        const data = await this.prisma.salary.delete({
            where: { id },
        });
        return data;
    }
}
