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

    async login(email: string, password: string, fcmToken?: string) {
        const validate: boolean = await this.userService.validateUser(email, password);
        if (validate) {
            const payload = {
                email: email,
                password: password,
            }
            const accessToken = this.jwtService.sign(payload, {
                secret: process.env.SYSTEM_SECRET,

            });
            const user = await this.prisma.user.update({
                where: {
                    email: email,
                },
                data: {
                    accessToken: accessToken,
                }
            });

            //Update device token
            await this.prisma.user.update({
                where: {
                    email: email,
                },
                data: {
                    fcmToken: fcmToken,
                }
            })

            return {
                accessToken,
                role: user.role,
                userId: user.id,
                isActive: user.isActive,
                email: user.email
            };
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
