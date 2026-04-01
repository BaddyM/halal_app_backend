import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards, Query, Inject } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, CustomerDto, UpdateCustomerDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
const fs = require("fs");
import { PrismaService } from 'src/prisma/prisma.service';

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
    @Get("all")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.userService.findAll(parseInt(page), parseInt(limit));
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get("loginAccess")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findLoginAccess(@Query("page") page: string, @Query("limit") limit: string) {
        return this.userService.loginAccess(parseInt(page), parseInt(limit));
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
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

    //Customer
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post('customer/create')
    create_customer(@Body() customerData: CustomerDto) {
        return this.userService.create_customer(customerData);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @Get('customer/list')
    get_customers(@Query("page") page: string, @Query("limit") limit: string) {
        return this.userService.get_customers(parseInt(page), parseInt(limit));
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiParam({ name: "id" })
    @Patch('customer/update/:id')
    update_customer(@Body() customerData: UpdateCustomerDto, @Param("id") id: string) {
        return this.userService.update_customer(id, customerData);
    }
}
