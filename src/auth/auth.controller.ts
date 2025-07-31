import { Body, Controller, Get, Headers, InternalServerErrorException, Post, Res, UseGuards } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from './auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private prisma: PrismaService,
    ) { }

    @Post("login")
    async login(
        @Body() loginData: LoginDto,
        @Res() res: Response,
    ) {
        try {
            const data = await this.authService.login(loginData.email, loginData.password, loginData.fcmToken);
            return res.status(200).json({
                success: true,
                accessToken: data,
            });
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException({
                success: false,
                message: "Authentication failed",
            })
        }
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
