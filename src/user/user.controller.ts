import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

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
    @Get("all")
    findAll() {
        return this.userService.findAll();
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiParam({name:"userId"})
    @Get(':userId')
    findOne(@Param('userId') userId: string) {
        return this.userService.findOne(userId);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiParam({name:"userId"})
    @Patch(':userId')
    update(@Param('userId') userId: string, @Body() updateUserDto: UpdateUserDto) {
        return this.userService.update(userId, updateUserDto);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @ApiParam({name:"userId"})
    @Delete(':userId')
    remove(@Param('userId') userId: string) {
        return this.userService.remove(userId);
    }
}
