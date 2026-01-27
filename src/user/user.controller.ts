import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards, Query, Inject, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Cache, CACHE_MANAGER, CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
    ) { }

    @Post("create")
    async create(
        @Res() res: Response,
        @Body() createUserDto: CreateUserDto,
    ) {
        try {
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
        await this.cache.del(`user/${userId}`);
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
