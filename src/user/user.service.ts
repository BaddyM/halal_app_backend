import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto, CustomerDto, UpdateCustomerDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
const bcrypt = require("bcryptjs");

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

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

    async findAll(page: number, limit: number) {
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
            orderBy: {
                createdAt: "desc"
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
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
        return await this.prisma.user.update({
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
    }

    async remove(userId: string) {
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
        return data;
    }

    //Customer
    async create_customer(customerDto: CustomerDto) {
        const data = await this.prisma.customer.create({
            data: customerDto,
        });
        return data;
    }

    async get_customers(page: number, limit: number) {
        const data = await this.prisma.customer.findMany({
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });
        return data;
    }

    async update_customer(id: string, updateCustomerDto: UpdateCustomerDto) {
        const data = await this.prisma.customer.update({
            where: { id },
            data: updateCustomerDto,
        });
        return data;
    }
}