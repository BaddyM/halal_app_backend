import { Body, Controller, Get, Headers, Inject, InternalServerErrorException, Post, Query, Res, UseGuards } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from './auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) { }

    @Post("login")
    async login(
        @Body() loginData: LoginDto,
    ) {
        await this.cache.del("/user/loginAccess?page=1&limit=10")
        const data = await this.authService.login(loginData.email, loginData.password, loginData.fcmToken, loginData.device, loginData.ipAddress);
        return data;
    }

    @ApiBearerAuth()
    @Post("send_otp")
    @ApiQuery({ name: "userId" })
    async send_otp(@Query("userId") userId: string) {
        const data = await this.authService.send_otp(userId);
        return data;
    }

    @ApiBearerAuth()
    @Get("verify_otp")
    @ApiQuery({ name: "userId" })
    @ApiQuery({ name: "otp" })
    async verify_otp(@Query("userId") userId: string, @Query("otp") otp: string) {
        const data = await this.authService.verify_otp(userId, parseInt(otp));
        return data;
    }

    @Get("logout")
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    async logout(
        @Headers("authorization") authHeader: string,
        @Res() res: Response,
    ) {
        try {
            const accessToken = authHeader.split(" ")[1];
            const userId = await this.prisma.user.findFirst({
                where: {
                    accessToken: accessToken,
                },
                select: {
                    id: true,
                }
            });
            await this.prisma.user.update({
                where: {
                    id: userId?.id,
                },
                data: {
                    accessToken: null,
                }
            });
            return res.status(200).json({
                success: true,
                message: "User logged out successfully",
            });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException({
                success: false,
                message: "Authentication failed",
            })
        }
    }
}
