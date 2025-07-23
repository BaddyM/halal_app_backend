import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
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
                name: createUserDto.name,
                email: createUserDto.email,
                password: password,
                role: createUserDto.role,
            },
        })
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

    async findAll() {
        const data = await this.prisma.user.findMany({
            where: {
                email: {
                    not: "arnoldhenry958@gmail.com",
                }
            },
        });
        return data;
    }

    async findOne(userId: string) {
        const data = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                name: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return data;
    }

    async update(userId: string, updateUserDto: UpdateUserDto) {
        const data = await this.prisma.user.update({
            where: {
                id: userId,
            },
            data: updateUserDto,
            select: {
                name: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return data;
    }

    async updatePassword(userId: string, updateUserDto: UpdateUserDto) {
        const data = await this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                password: bcrypt.hash(updateUserDto.password, 10),
            },
            select: {
                name: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return data;
    }

    async remove(userId: string) {
        const data = await this.prisma.user.delete({
            where: {
                id: userId,
            },
            select: {
                name: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return data;
    }
}
