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
    @ApiQuery({ name: "role", required: false })
    findAll(@Query("page") page: string, @Query("limit") limit: string, @Query("role") role: string) {
        return this.userService.findAll(parseInt(page), parseInt(limit), role);
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

    //Commissions
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get(':userId/commission/:period')
    @ApiParam({ name: 'userId' })
    @ApiParam({ name: 'period' })
    compute_commission(@Param('userId') userId: string, @Param('period') period: string) {
        return this.userService.compute_commission(userId, period);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post(':userId/commission/:period/payout')
    @ApiParam({ name: 'userId' })
    @ApiParam({ name: 'period' })
    create_commission_payout(@Param('userId') userId: string, @Param('period') period: string) {
        return this.userService.create_commission_payout(userId, period);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get('commission/payouts/list')
    @ApiQuery({ name: 'userId', required: false })
    list_commission_payouts(@Query('userId') userId?: string) {
        return this.userService.list_commission_payouts(userId);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Patch('commission/payout/:id/paid')
    @ApiParam({ name: 'id' })
    mark_commission_paid(@Param('id') id: string) {
        return this.userService.mark_commission_paid(id);
    }
}
