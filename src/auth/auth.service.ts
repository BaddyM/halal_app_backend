import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService,
        private userService: UserService,
        private jwtService: JwtService,
    ) { }

    async login(email: string, password: string) {
        const validate: boolean = await this.userService.validateUser(email, password);
        if (validate) {
            const payload = {
                email: email,
                password: password,
            }
            const accessToken = this.jwtService.sign(payload, {
                secret: process.env.SYSTEM_SECRET
            });
            await this.prisma.user.update({
                where: {
                    email: email,
                },
                data: {
                    accessToken: accessToken,
                }
            });
            return accessToken;
        }
        throw new UnauthorizedException({
            success: false,
            message: "User not authorized",
        });
    }

    async logout(userId: string) {
        const data = await this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                accessToken: null,
            },
            select: {
                name: true,
                email: true,
                accessToken: true,
            }
        });
        return data;
    }
}
