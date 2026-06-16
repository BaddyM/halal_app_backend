import {
    BadRequestException,
    Injectable,
    Logger,
    UnauthorizedException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { OAuthService } from './oauth.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly oauth: OAuthService,
        private readonly realtime: RealtimeBus,
    ) {}

    private logCode(kind: 'verify' | 'reset' | 'otp', email: string, code: string) {
        if (this.config.get('MODE') === 'Dev') {
            this.logger.log(
                `📬 [${kind}] ${email} → code: ${code} (dev only — email delivery not configured)`,
            );
        }
    }

    // ── helpers ─────────────────────────────────────────────────
    private async hash(plain: string) {
        return bcrypt.hash(plain, 10);
    }

    private async compare(plain: string, hashed: string) {
        return bcrypt.compare(plain, hashed);
    }

    private generateCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private async issueTokens(userId: string, email: string) {
        const accessToken = await this.jwt.signAsync(
            { sub: userId, email },
            { expiresIn: '7d' },
        );

        const refreshTokenValue = uuid();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

        await this.prisma.refreshToken.create({
            data: {
                userId,
                token: refreshTokenValue,
                expiresAt,
            },
        });

        return { accessToken, refreshToken: refreshTokenValue };
    }

    private sanitizeUser(user: any) {
        const { password, ...rest } = user;
        return rest;
    }

    // ── signup ──────────────────────────────────────────────────
    async signup(name: string, email: string, password: string) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('Email already registered');

        const hashed = await this.hash(password);
        const user = await this.prisma.user.create({
            data: {
                name,
                email,
                password: hashed,
                profile: { create: {} },
            },
            include: { profile: true },
        });

        // Email verification code (returned in dev; in prod would be emailed)
        const code = this.generateCode();
        await this.prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                code,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
        this.logCode('verify', user.email, code);

        // Live admin feed.
        this.realtime.emitAdminEvent('signup', `${user.name} joined`, { userId: user.id });

        const tokens = await this.issueTokens(user.id, user.email);

        return {
            user: this.sanitizeUser(user),
            ...tokens,
            // In production, do NOT return the code — email it instead.
            verificationCode: this.config.get('MODE') === 'Dev' ? code : undefined,
        };
    }

    // ── login ───────────────────────────────────────────────────
    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { profile: true },
        });
        if (!user) throw new UnauthorizedException('Invalid email or password');
        if (!user.isActive) throw new UnauthorizedException('Account disabled');

        const ok = await this.compare(password, user.password);
        if (!ok) throw new UnauthorizedException('Invalid email or password');

        // Bootstrap admins from config: any email in ADMIN_EMAILS is promoted to
        // the admin role on login (so the dashboard works without manual DB edits).
        const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
        const shouldBeAdmin = adminEmails.includes(email.toLowerCase());

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                lastSeenAt: new Date(),
                ...(shouldBeAdmin && user.role !== 'admin' && { role: 'admin' }),
            },
        });
        if (shouldBeAdmin) user.role = 'admin';

        const tokens = await this.issueTokens(user.id, user.email);
        return { user: this.sanitizeUser(user), ...tokens };
    }

    // ── verify email ────────────────────────────────────────────
    async verifyEmail(email: string, code: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new NotFoundException('User not found');

        const token = await this.prisma.emailVerificationToken.findFirst({
            where: {
                userId: user.id,
                code,
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!token) throw new BadRequestException('Invalid or expired code');

        await this.prisma.$transaction([
            this.prisma.emailVerificationToken.update({
                where: { id: token.id },
                data: { consumedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: user.id },
                data: { isEmailVerified: true },
            }),
        ]);

        return { success: true };
    }

    async resendVerification(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new NotFoundException('User not found');
        if (user.isEmailVerified) return { success: true };

        const code = this.generateCode();
        await this.prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                code,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
        this.logCode('verify', user.email, code);

        return {
            success: true,
            verificationCode: this.config.get('MODE') === 'Dev' ? code : undefined,
        };
    }

    // ── forgot password ─────────────────────────────────────────
    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        // Do not leak existence in prod
        if (!user) return { success: true };

        const code = this.generateCode();
        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                code,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
        this.logCode('reset', user.email, code);

        return {
            success: true,
            resetCode: this.config.get('MODE') === 'Dev' ? code : undefined,
        };
    }

    async resetPassword(email: string, code: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new NotFoundException('User not found');

        const token = await this.prisma.passwordResetToken.findFirst({
            where: {
                userId: user.id,
                code,
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!token) throw new BadRequestException('Invalid or expired code');

        const hashed = await this.hash(newPassword);

        await this.prisma.$transaction([
            this.prisma.passwordResetToken.update({
                where: { id: token.id },
                data: { consumedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: user.id },
                data: { password: hashed },
            }),
            // Revoke all refresh tokens after password reset
            this.prisma.refreshToken.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);

        return { success: true };
    }

    // ── refresh token ───────────────────────────────────────────
    async refresh(refreshToken: string) {
        const stored = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Rotate
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
        });

        const tokens = await this.issueTokens(stored.user.id, stored.user.email);
        return { user: this.sanitizeUser(stored.user), ...tokens };
    }

    async logout(refreshToken: string) {
        await this.prisma.refreshToken.updateMany({
            where: { token: refreshToken, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { success: true };
    }

    // ── phone OTP ───────────────────────────────────────────────
    /// Send a 6-digit code to a phone number. The phone must already belong to
    /// an account (the user sets it during onboarding/profile). On success the
    /// code is texted via the SMS provider; in Dev it is logged and returned.
    async sendOtp(phone: string) {
        const user = await this.prisma.user.findFirst({ where: { phone } });
        if (!user) {
            // Don't leak which phones exist; pretend success.
            return { success: true };
        }

        const code = this.generateCode();
        await this.prisma.phoneVerificationToken.create({
            data: {
                userId: user.id,
                phone,
                code,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        });
        this.logCode('otp', phone, code);
        // TODO: integrate an SMS provider (Twilio/SNS) for production delivery.

        return {
            success: true,
            otpCode: this.config.get('MODE') === 'Dev' ? code : undefined,
        };
    }

    /// Verify a phone OTP. Marks the phone verified and logs the user in
    /// (passwordless) by issuing a fresh token pair.
    async verifyOtp(phone: string, code: string) {
        const token = await this.prisma.phoneVerificationToken.findFirst({
            where: {
                phone,
                code,
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            include: { user: { include: { profile: true } } },
        });
        if (!token) throw new BadRequestException('Invalid or expired code');

        await this.prisma.$transaction([
            this.prisma.phoneVerificationToken.update({
                where: { id: token.id },
                data: { consumedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: token.userId },
                data: { isPhoneVerified: true, lastSeenAt: new Date() },
            }),
        ]);

        const tokens = await this.issueTokens(token.user.id, token.user.email);
        return {
            user: this.sanitizeUser({ ...token.user, isPhoneVerified: true }),
            ...tokens,
        };
    }

    // ── OAuth (Google / Apple) ──────────────────────────────────
    async oauthGoogle(idToken: string) {
        const profile = await this.oauth.verifyGoogle(idToken);
        return this.oauthUpsert('google', profile);
    }

    async oauthApple(idToken: string, name?: string) {
        const profile = await this.oauth.verifyApple(idToken, name);
        return this.oauthUpsert('apple', profile);
    }

    /// Find-or-create a user for a verified OAuth profile, link the provider
    /// id, and issue tokens. Existing email accounts are linked (not blocked)
    /// so a user can sign in with either method.
    private async oauthUpsert(
        provider: 'google' | 'apple',
        profile: { providerId: string; email: string | null; name: string | null; emailVerified: boolean },
    ) {
        const idField = provider === 'google' ? 'googleId' : 'appleId';

        // 1) Already linked by provider id?
        let user = await this.prisma.user.findFirst({
            where: { [idField]: profile.providerId } as any,
            include: { profile: true },
        });

        // 2) Otherwise match by email and link the provider id.
        if (!user && profile.email) {
            const byEmail = await this.prisma.user.findUnique({
                where: { email: profile.email },
                include: { profile: true },
            });
            if (byEmail) {
                user = await this.prisma.user.update({
                    where: { id: byEmail.id },
                    data: { [idField]: profile.providerId } as any,
                    include: { profile: true },
                });
            }
        }

        // 3) Create a fresh account. OAuth users get a random unusable password.
        if (!user) {
            const email =
                profile.email ?? `${provider}_${profile.providerId}@oauth.local`;
            const randomPassword = await this.hash(uuid());
            user = await this.prisma.user.create({
                data: {
                    email,
                    password: randomPassword,
                    name: profile.name?.trim() || email.split('@')[0],
                    isEmailVerified: profile.emailVerified,
                    [idField]: profile.providerId,
                    profile: { create: {} },
                } as any,
                include: { profile: true },
            });
            // Live admin feed (new OAuth account).
            this.realtime.emitAdminEvent('signup', `${user.name} joined`, {
                userId: user.id,
                provider,
            });
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastSeenAt: new Date() },
        });

        const tokens = await this.issueTokens(user.id, user.email);
        return { user: this.sanitizeUser(user), ...tokens };
    }
}
