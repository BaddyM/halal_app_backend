import { Injectable } from '@nestjs/common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StaffService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createStaffDto: CreateStaffDto) {
        const data = await this.prisma.staff.create({
            data: {
                userId: userId,
                name: createStaffDto.name,
                baseSalary: createStaffDto.baseSalary,
                role: createStaffDto.role,
                payPeriod: createStaffDto.payPeriod != null ? new Date(createStaffDto.payPeriod) : null,
            },
        });
        return data;
    }

    async findAll() {
        const data = await this.prisma.staff.findMany();
        return data;
    }

    async findOne(id: string) {
        const data = await this.prisma.staff.findFirst({
            where: {
                id: id,
            }
        });
        return data;
    }

    async update(id: string, updateStaffDto: UpdateStaffDto) {
        const data = await this.prisma.staff.update({
            where: {
                id: id,
            },
            data: updateStaffDto,
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.staff.delete({
            where: {
                id: id,
            }
        });
        return data;
    }
}
