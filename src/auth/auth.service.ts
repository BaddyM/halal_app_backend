import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, HttpException, Inject, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { Cache } from "cache-manager";
import { time } from 'console';
import { randomBytes } from 'crypto';
const bcrypt = require("bcryptjs");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService,
        private userService: UserService,
        private jwtService: JwtService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async login(email: string, password: string) {
        try {
            const existing = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true, lockedUntil: true, failedLoginCount: true },
            });
            if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
                throw new UnauthorizedException(
                    `Account is locked until ${existing.lockedUntil.toISOString()}. Try again later or reset your password.`,
                );
            }

            const validate: boolean = await this.userService.validateUser(email, password);
            if (!validate) {
                if (existing) {
                    const newCount = (existing.failedLoginCount ?? 0) + 1;
                    const willLock = newCount >= MAX_FAILED_ATTEMPTS;
                    await this.prisma.user.update({
                        where: { id: existing.id },
                        data: {
                            failedLoginCount: newCount,
                            lockedUntil: willLock
                                ? new Date(Date.now() + LOCK_DURATION_MS)
                                : null,
                        },
                    });
                }
                // Throwing here goes to the catch block
                throw new UnauthorizedException("User not authorized");
            }

            if (validate) {
                const payload = {
                    email,
                }

                const accessToken = this.jwtService.sign(payload, {
                    secret: process.env.SYSTEM_SECRET,
                    expiresIn: '24hr',
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
                        failedLoginCount: 0,
                        lockedUntil: null,
                    }
                });

                //Add new token in cache
                const cacheKey = `auth_session:${user.accessToken}`
                await this.cacheManager.set(cacheKey, user.accessToken, 300000) //Cache set for 5 minutes

                //Add to login access
                await this.prisma.loginAccess.create({
                    data: {
                        userId: user.id,
                    }
                })

                return {
                    accessToken,
                    role: user.role,
                    userId: user.id,
                    name: user.name,
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
                name: true,
                email: true,
                accessToken: true,
            }
        });
        return data;
    }

    //Password Reset
    async request_password_reset(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        // Always succeed silently to avoid leaking which emails exist
        if (!user) return { ok: true };

        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        await this.prisma.passwordResetToken.create({
            data: { userId: user.id, token, expiresAt },
        });
        // TODO: send email via configured mailer.
        if (process.env.MODE === 'Dev') {
            console.log(`[password-reset] token for ${email}: ${token}`);
        }
        return { ok: true, devToken: process.env.MODE === 'Dev' ? token : undefined };
    }

    async reset_password(token: string, newPassword: string) {
        if (!newPassword || newPassword.length < 6) {
            throw new BadRequestException('Password must be at least 6 characters');
        }
        const record = await this.prisma.passwordResetToken.findUnique({
            where: { token },
        });
        if (!record || record.usedAt || record.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: record.userId },
                data: {
                    password: hashed,
                    failedLoginCount: 0,
                    lockedUntil: null,
                },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: record.id },
                data: { usedAt: new Date() },
            }),
        ]);
        return { ok: true };
    }

    async unlock_user(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { failedLoginCount: 0, lockedUntil: null },
        });
    }
}
