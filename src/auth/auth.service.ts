import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, Inject, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { Cache } from "cache-manager";
import { SettingsService } from 'src/settings/settings.service';
import { time } from 'console';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService,
        private userService: UserService,
        private jwtService: JwtService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly settingService: SettingsService
    ) { }

    async login(email: string, password: string, fcmToken?: string, device?: string, ipAddress?: string) {
        try {
            const validate: boolean = await this.userService.validateUser(email, password);
            if (!validate) {
                // Throwing here goes to the catch block
                throw new UnauthorizedException("User not authorized");
            }

            if (validate) {
                const payload = {
                    email,
                }

                const accessToken = this.jwtService.sign(payload, {
                    secret: process.env.SYSTEM_SECRET,
                    expiresIn: '24h',
                });

                const check_user = await this.prisma.user.findFirst({
                    where: {
                        email,
                        isActive: true,
                    }
                });

                if (!check_user) {
                    throw new UnauthorizedException("Account is inactive or not found");
                }

                //Delete previous token from cache
                const previous_access_token = await this.prisma.user.findFirst({
                    where: {
                        email,
                    },
                    select: {
                        accessToken: true,
                    }
                });
                const oldCacheKey = `auth_session:${previous_access_token}`;
                await this.cacheManager.del(oldCacheKey)

                const user = await this.prisma.user.update({
                    where: {
                        email,
                    },
                    data: {
                        accessToken,
                    }
                });

                //Add new token in cache
                const cacheKey = `auth_session:${user.accessToken}`
                await this.cacheManager.set(cacheKey, user.accessToken, 300000) //Cache set for 5 minutes

                //Update device token
                await this.prisma.user.update({
                    where: {
                        email,
                    },
                    data: {
                        fcmToken,
                    }
                });

                //Add to login access
                await this.prisma.loginAccess.create({
                    data: {
                        userId: user.id,
                    }
                })

                await this.settingService.sendLoginMail(user.email!, user.firstName, device, ipAddress, `${new Date().toDateString()} at ${new Date().toLocaleTimeString()}`);

                return {
                    accessToken,
                    role: user.role,
                    userId: user.id,
                    isActive: user.isActive,
                    email: user.email
                };
            }
        } catch (e) {
            // If it's already a NestJS defined error (401, 403, 404), just re-throw it
            if (e instanceof UnauthorizedException || e instanceof HttpException) {
                throw e;
            }

            // Only log and 500 on REAL system crashes (Database down, code bugs)
            if (process.env.MODE === "Dev") {
                console.error("[Login Error]:", e);
            }

            throw new InternalServerErrorException("Failed to login the user");
        }
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
                firstName: true,
                lastName: true,
                email: true,
                accessToken: true,
            }
        });
        return data;
    }

    async send_otp(userId: string) {
        const OTP_EXPIRY_MINUTES = 10;
        const OTP_LENGTH = 6;

        const otp = Math.floor(
            10 ** (OTP_LENGTH - 1) +
            Math.random() * 9 * 10 ** (OTP_LENGTH - 1)
        );

        const expiresAt = new Date(
            Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        );

        // Invalidate previous OTPs
        await this.prisma.otpVerification.deleteMany({
            where: { userId },
        });

        // Create new OTP
        const data = await this.prisma.otpVerification.create({
            data: {
                userId,
                otp,
                expiresAt,
            },
            include: {
                user: {
                    select: {
                        email: true
                    }
                }
            }
        });

        await this.settingService.sendOtpMail(data.user.email!, otp);
        return {
            message: 'OTP sent successfully',
        };
    }


    async verify_otp(userId: string, otp: number) {
        const record = await this.prisma.otpVerification.findFirst({
            where: {
                userId,
                otp,
            },
            orderBy: { createdAt: "desc" }
        });

        if (!record) {
            throw new UnauthorizedException('Invalid OTP');
        }

        if (record.expiresAt < new Date()) {
            throw new UnauthorizedException('OTP expired');
        }

        return {
            message: 'OTP verified successfully',
        };
    }


    async token_valid(token: string) {

    }
}
