import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateSalaryAdvanceDto, CreateSalaryDto, CreateStaffDto, UpdateSalaryDto } from './dto/create-staff.dto';
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
        const allowances = createSalaryDto.allowances ?? 0;
        const deductions = createSalaryDto.deductions ?? 0;
        const advanceDeducted = createSalaryDto.advanceDeducted ?? 0;
        const netPay =
            createSalaryDto.amount + allowances - deductions - advanceDeducted;
        const data = await this.prisma.salary.create({
            data: {
                ...createSalaryDto,
                allowances,
                deductions,
                advanceDeducted,
                netPay,
            },
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

    async mark_salary_paid(id: string) {
        return this.prisma.salary.update({
            where: { id },
            data: { status: 'COMPLETED', paidAt: new Date() },
        });
    }

    async generate_payslip(id: string) {
        const salary = await this.prisma.salary.findUnique({
            where: { id },
            include: { staff: true },
        });
        if (!salary) {
            throw new InternalServerErrorException('Salary not found');
        }
        return {
            staff: {
                name: salary.staff.name,
                role: salary.staff.role,
                phone: salary.staff.phone,
                email: salary.staff.email,
            },
            period: salary.period,
            baseAmount: salary.amount,
            allowances: salary.allowances,
            deductions: salary.deductions,
            advanceDeducted: salary.advanceDeducted,
            netPay: salary.netPay,
            status: salary.status,
            paidAt: salary.paidAt,
            memo: salary.memo,
        };
    }

    //Salary Advances
    async create_salary_advance(dto: CreateSalaryAdvanceDto) {
        return this.prisma.salaryAdvance.create({
            data: {
                staffId: dto.staffId,
                amount: dto.amount,
                reason: dto.reason,
            },
        });
    }

    async list_salary_advances(staffId?: string) {
        return this.prisma.salaryAdvance.findMany({
            where: staffId ? { staffId } : {},
            include: {
                staff: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async repay_salary_advance(id: string) {
        return this.prisma.salaryAdvance.update({
            where: { id },
            data: { status: 'REPAID', repaidAt: new Date() },
        });
    }
}
