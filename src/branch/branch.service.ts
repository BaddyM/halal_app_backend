import { Injectable } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BranchService {
    constructor(private readonly prisma: PrismaService) { }
    async create(createBranchDto: CreateBranchDto) {
        const data = await this.prisma.branch.create({
            data: createBranchDto,
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.branch.findMany({
            skip: (page - 1),
            take: limit,
            orderBy: { createdAt: "desc" }
        })
        return data;
    }

    async update(id: string, updateBranchDto: UpdateBranchDto) {
        const data = await this.prisma.branch.update({
            where: { id },
            data: updateBranchDto
        });
        return data;
    }

    async remove(id: string) {
        const data = await this.prisma.branch.update({
            where: { id },
            data: { isActive: true }
        });
        return data;
    }
}
