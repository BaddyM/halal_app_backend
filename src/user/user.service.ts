import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocumentType } from '@prisma/client';
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
                firstName: true,
                lastName: true,
                occupation: true,
                maritalStatus: true,
                nationalId: true,
                city: true,
                streetAddress: true,
                district: true,
                phoneNumber: true,
                secondaryPhoneNumber: true,
                gender: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        //Add to settings
        await this.prisma.settings.create({
            data: { userId: data.id },
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
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                        occupation: true,
                        nationalId: true,
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
                firstName: true,
                lastName: true,
                occupation: true,
                maritalStatus: true,
                nationalId: true,
                city: true,
                streetAddress: true,
                district: true,
                phoneNumber: true,
                secondaryPhoneNumber: true,
                gender: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                dob: true,
                documents: true,
                settings: true,
                createdAt: true,
                updatedAt: true,
                targets: true,
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
                firstName: true,
                lastName: true,
                occupation: true,
                maritalStatus: true,
                nationalId: true,
                city: true,
                streetAddress: true,
                district: true,
                phoneNumber: true,
                secondaryPhoneNumber: true,
                gender: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                dob: true,
                settings: true,
                createdAt: true,
                updatedAt: true,
                documents: true,
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
                firstName: true,
                lastName: true,
                occupation: true,
                maritalStatus: true,
                nationalId: true,
                city: true,
                streetAddress: true,
                district: true,
                phoneNumber: true,
                secondaryPhoneNumber: true,
                gender: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    }

    async updateProfilePicture(userId: string, profilePicture: string) {
        return await this.prisma.user.update({
            where: { id: userId },
            data: {
                profilePicture
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                occupation: true,
                maritalStatus: true,
                nationalId: true,
                city: true,
                streetAddress: true,
                district: true,
                phoneNumber: true,
                secondaryPhoneNumber: true,
                gender: true,
                email: true,
                profilePicture: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    }

    async uploadDocument(userId: string, docType: DocumentType, docName: string) {
        try {
            const data = await this.prisma.document.create({
                data: {
                    userId,
                    documentType: docType,
                    name: docName
                }
            });
            return data;
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("Error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                error: e,
            });
        }
    }

    async remove(userId: string) {
        const data = await this.prisma.user.delete({
            where: {
                id: userId,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                occupation: true,
                maritalStatus: true,
                nationalId: true,
                city: true,
                streetAddress: true,
                district: true,
                phoneNumber: true,
                secondaryPhoneNumber: true,
                gender: true,
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
