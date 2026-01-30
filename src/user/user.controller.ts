import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards, Query, Inject, UseInterceptors, UploadedFiles, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Cache, CACHE_MANAGER, CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from "multer";
const fs = require("fs");
import * as path from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocumentType } from '@prisma/client';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
        private readonly prisma: PrismaService,
    ) { }

    @Post("create")
    async create(
        @Res() res: Response,
        @Body() createUserDto: CreateUserDto,
    ) {
        try {
            await this.cache.del("/user/all?page=1&limit=10");
            const data = await this.userService.create(createUserDto);
            return res.status(200).json({
                success: true,
                message: "Created user successfully",
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: "Failed to create user",
            })
        }
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post("update/profilePicture/:userId")
    @ApiParam({ name: "userId" })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FilesInterceptor('image', 8, {
            storage: memoryStorage(),
            limits: {
                fileSize: 1 * 1024 * 1024
            },
            fileFilter: (req, file, cb) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
                    return cb(new BadRequestException('Only image files are allowed!'), false);
                }
                cb(null, true);
            },
        }),
    )
    async updateProfilePicture(
        @UploadedFiles() file: Express.Multer.File,
        @Param("userId") userId: string,
    ) {
        const current_profile_picture = await this.prisma.user.findFirst({
            where: { id: userId },
            select: { profilePicture: true }
        });

        if (!current_profile_picture) {
            throw new NotFoundException({
                success: false,
                message: "User not found",
            });
        }

        if (current_profile_picture.profilePicture != null) {
            //Delete previous if exists
            fs.unlinkSync(`./uploads/users/${current_profile_picture.profilePicture}`, (err: any) => {
                throw new InternalServerErrorException({
                    success: false,
                    message: "Failed to delete previous image",
                    error: err,
                });
            });
        }

        const ext = path.extname(file[0].originalname); // keep the original file extension
        const randomPart = randomBytes(6).toString('hex'); // e.g. 'a3f4c9d2'
        const timestamp = Date.now();
        const newFileName = `user_${timestamp}_${randomPart}${ext}`;
        const uploadPath = `./uploads/users/${newFileName}`;
        fs.writeFileSync(uploadPath, file[0].buffer); // Save the file manually
        return this.userService.updateProfilePicture(userId, newFileName);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post("upload/document/:userId")
    @ApiQuery({ name: "docType" })
    @ApiParam({ name: "userId" })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FilesInterceptor('image', 8, {
            storage: memoryStorage(),
            limits: {
                fileSize: 1 * 1024 * 1024
            },
            fileFilter: (req, file, cb) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
                    return cb(new BadRequestException('Only image files are allowed!'), false);
                }
                cb(null, true);
            },
        })
    )
    async updateDocument(
        @UploadedFiles() file: Express.Multer.File,
        @Param("userId") userId: string,
        @Query("docType") docType: DocumentType,
    ) {
        const current_user = await this.prisma.user.findFirst({
            where: { id: userId }
        });

        if (!current_user) {
            throw new NotFoundException({
                success: false,
                message: "User not found",
            });
        }

        const ext = path.extname(file[0].originalname); // keep the original file extension
        const randomPart = randomBytes(6).toString('hex'); // e.g. 'a3f4c9d2'
        const timestamp = Date.now();
        const newFileName = `doc_${timestamp}_${randomPart}${ext}`;
        const uploadPath = `./uploads/documents/${newFileName}`;
        fs.writeFileSync(uploadPath, file[0].buffer); // Save the file manually
        return this.userService.uploadDocument(userId, docType, newFileName);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300_000)
    @Get("all")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.userService.findAll(parseInt(page), parseInt(limit));
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300_000)
    @Get("loginAccess")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findLoginAccess(@Query("page") page: string, @Query("limit") limit: string) {
        return this.userService.loginAccess(parseInt(page), parseInt(limit));
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300_000)
    @ApiParam({ name: "userId" })
    @Get(':userId')
    findOne(@Param('userId') userId: string) {
        return this.userService.findOne(userId);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiParam({ name: "userId" })
    @Patch(':userId')
    async update(@Param('userId') userId: string, @Body() updateUserDto: UpdateUserDto) {
        await this.cache.del(`/user/${userId}`);
        return this.userService.update(userId, updateUserDto);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiParam({ name: "userId" })
    @Delete(':userId')
    remove(@Param('userId') userId: string) {
        return this.userService.remove(userId);
    }
}
