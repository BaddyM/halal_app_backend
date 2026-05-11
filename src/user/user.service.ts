import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto, CustomerDto, UpdateCustomerDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/audit/audit.service';
const bcrypt = require("bcryptjs");

@Injectable()
export class UserService {
    constructor(
        private prisma: PrismaService,
        private readonly auditService: AuditService,
    ) { }

    async create(createUserDto: CreateUserDto) {
        const password = await bcrypt.hash(`${createUserDto.password}`, 10);
        const data = await this.prisma.user.create({
            data: {
                ...createUserDto,
                password: password,
            },
            select: {
                id: true,
                name: true,
                branch: {
                    select: {
                        name: true,
                        address: true,
                        contact: true,
                    }
                },
                email: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        await this.auditService.log({
            action: 'USER_CREATED',
            entity: 'User',
            entityId: data.id,
            after: data,
        });

        return data;
    }

    async validateUser(email: string, password: string) {
        const getPassword = await this.prisma.user.findUnique({
            where: {
                email: email
            }
        });
        const checkPassword: boolean = await bcrypt.compare(`${password}`, getPassword!.password);
        return checkPassword;
    }

    async loginAccess(page: number, limit: number) {
        const data = await this.prisma.loginAccess.findMany({
            select: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        branch: {
                            select: {
                                name: true,
                                address: true,
                                contact: true,
                            }
                        },
                    }
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: "desc"
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
    }

    async findAll(page: number, limit: number, role?: string) {
        let filter = {}

        if (role != "" && role != undefined && role != "undefined" && role != null && role != "none") {
            (filter as any).role = role;
        }

        const data = await this.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                branch: {
                    select: {
                        name: true,
                        address: true,
                        contact: true,
                    }
                },
                email: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
            where: {
                ...filter
            },
            orderBy: {
                createdAt: "desc"
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        const total = await this.prisma.user.count();
        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
    }

    async findOne(userId: string) {
        const data = await this.prisma.user.findFirst({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                branch: {
                    select: {
                        name: true,
                        address: true,
                        contact: true,
                    }
                },
                email: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return data;
    }

    async update(userId: string, updateUserDto: UpdateUserDto) {
        // 1. Destructure the password out of the DTO
        const { password, ...otherData } = updateUserDto;

        // 2. Prepare the update data object
        const updateData: any = { ...otherData };

        // 3. Conditionally hash and add the password if it exists
        if (password) {
            updateData.password = await bcrypt.hash(`${password}`, 10);
        }

        // 4. Perform a single Prisma call
        const before = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                branchId: true,
                isActive: true,
                commissionRate: true,
            },
        });

        const data = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                branch: {
                    select: {
                        name: true,
                        address: true,
                        contact: true,
                    }
                },
                email: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        await this.auditService.log({
            action: 'USER_UPDATED',
            entity: 'User',
            entityId: userId,
            before,
            after: data,
        });

        return data;
    }

    async remove(userId: string) {
        const before = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                branchId: true,
                isActive: true,
                commissionRate: true,
            },
        });

        const data = await this.prisma.user.delete({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                branch: {
                    select: {
                        name: true,
                        address: true,
                        contact: true,
                    }
                },
                email: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        await this.auditService.log({
            action: 'USER_DELETED',
            entity: 'User',
            entityId: userId,
            before,
        });

        return data;
    }

    //Customer
    async create_customer(customerDto: CustomerDto) {
        const data = await this.prisma.customer.create({
            data: customerDto,
        });

        await this.auditService.log({
            action: 'CUSTOMER_CREATED',
            entity: 'Customer',
            entityId: data.id,
            after: data,
        });

        return data;
    }

    async get_customers(page: number, limit: number) {
        const data = await this.prisma.customer.findMany({
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });
        const total = await this.prisma.customer.count();
        const totalPages = Math.ceil(total / limit);
        return { data, totalPages };
    }

    async update_customer(id: string, updateCustomerDto: UpdateCustomerDto) {
        const before = await this.prisma.customer.findUnique({ where: { id } });
        const data = await this.prisma.customer.update({
            where: { id },
            data: updateCustomerDto,
        });

        await this.auditService.log({
            action: 'CUSTOMER_UPDATED',
            entity: 'Customer',
            entityId: id,
            before,
            after: data,
        });

        return data;
    }

    //Commissions
    async compute_commission(userId: string, period: string) {
        // period format: YYYY-MM
        const [year, month] = period.split('-').map(Number);
        if (!year || !month) {
            throw new InternalServerErrorException('Invalid period (use YYYY-MM)');
        }
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, commissionRate: true },
        });
        if (!user) {
            throw new InternalServerErrorException('User not found');
        }

        const sales = await this.prisma.sale.findMany({
            where: {
                repId: userId,
                createdAt: { gte: start, lt: end },
            },
            include: { returns: true },
        });

        let totalSales = 0;
        for (const s of sales) {
            const grossLine = s.unitPrice * s.quantity;
            const refundedAmount = s.returns
                .filter((r) => r.status === 'COMPLETED')
                .reduce((acc, r) => acc + r.refundAmount, 0);
            totalSales += grossLine - refundedAmount;
        }
        const totalCommission = totalSales * (user.commissionRate ?? 0);
        return {
            user,
            period,
            totalSales,
            totalCommission,
            commissionRate: user.commissionRate ?? 0,
        };
    }

    async create_commission_payout(userId: string, period: string) {
        const summary = await this.compute_commission(userId, period);
        const existing = await this.prisma.commissionPayout.findFirst({
            where: { userId, period },
        });
        if (existing) {
            throw new InternalServerErrorException(
                'Commission payout for this period already exists',
            );
        }
        return this.prisma.commissionPayout.create({
            data: {
                userId,
                period,
                totalSales: summary.totalSales,
                totalCommission: summary.totalCommission,
            },
        });
    }

    async list_commission_payouts(userId?: string) {
        return this.prisma.commissionPayout.findMany({
            where: userId ? { userId } : {},
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async mark_commission_paid(id: string) {
        return this.prisma.commissionPayout.update({
            where: { id },
            data: { status: 'PAID', paidAt: new Date() },
        });
    }
}