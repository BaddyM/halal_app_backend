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
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../mail/sms.service';
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
        private readonly mail: MailService,
        private readonly sms: SmsService,
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

        const refreshTokenValue = randomUUID();
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
        await this.mail.sendCodeEmail(user.email, code, 'verify').catch((error) => {
            this.logger.warn(`Failed to send verification email to ${user.email}: ${error.message}`);
        });

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
        //
        // The address must be VERIFIED first. Signup does not prove ownership of
        // an email, so without this check anyone could claim an ADMIN_EMAILS
        // entry that had not been registered yet and be handed full admin on
        // their first login.
        const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
        const listedAsAdmin = adminEmails.includes(email.toLowerCase());
        const shouldBeAdmin = listedAsAdmin && user.isEmailVerified;
        if (listedAsAdmin && !user.isEmailVerified) {
            this.logger.warn(
                `Admin promotion withheld for ${email}: email is not verified`,
            );
        }

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

    // ── phone OTP (passwordless login + phone verification) ─────
    /// The stored forms a typed number could correspond to. UsersService writes
    /// phones strictly as E.164 (`+` then digits, no separators) and rejects
    /// anything else, so stripping the separators a user typed is enough to hit
    /// the stored value exactly — no scan-and-compare needed. The bare-digits
    /// variant covers a caller that omitted the leading `+`.
    private phoneCandidates(phone: string): string[] {
        const stripped = phone.trim().replace(/[\s().-]/g, '');
        const digits = stripped.replace(/\D/g, '');
        if (digits.length < 6) return [];
        return Array.from(
            new Set([stripped, stripped.startsWith('+') ? stripped : `+${digits}`]),
        );
    }

    /// Resolves the single account owning [phone], or null. Returns null when
    /// more than one account shares the number: OTP is a login mechanism, and
    /// guessing which account to sign in to would be worse than refusing.
    private async userByPhone(phone: string) {
        const candidates = this.phoneCandidates(phone);
        if (candidates.length === 0) return null;
        const matches = await this.prisma.user.findMany({
            where: { phone: { in: candidates }, isActive: true },
            select: { id: true, email: true, phone: true },
            take: 2, // only need to know whether it is ambiguous
        });
        if (matches.length !== 1) {
            if (matches.length > 1) {
                this.logger.warn(
                    `OTP refused: multiple active accounts share phone ending ${phone.slice(-4)}`,
                );
            }
            return null;
        }
        return matches[0];
    }

    /// Issues a 6-digit code to [phone].
    ///
    /// Always reports success, whether or not the number belongs to an account,
    /// so this endpoint cannot be used to discover which phone numbers are
    /// registered. The code is only returned in Dev, for the UI to prefill.
    async sendOtp(phone: string) {
        const user = await this.userByPhone(phone);
        if (!user) {
            this.logger.log(`OTP requested for unregistered phone — no code sent`);
            return { sent: true };
        }

        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        // Retire any outstanding codes so only the newest one can be used.
        await this.prisma.phoneVerificationToken.updateMany({
            where: { userId: user.id, consumedAt: null },
            data: { consumedAt: new Date() },
        });
        await this.prisma.phoneVerificationToken.create({
            data: { userId: user.id, phone: user.phone!, code, expiresAt },
        });

        const delivered = await this.sms.sendCode(user.phone!, code);
        if (!delivered) {
            this.logger.warn(
                `SMS delivery unavailable — OTP for ${user.email} was not sent by SMS`,
            );
        }
        this.logCode('otp', user.email, code);

        return {
            sent: true,
            // Never leak the code outside development.
            otpCode: this.config.get('MODE') === 'Dev' ? code : undefined,
        };
    }

    /// Verifies [code] and signs the user in (passwordless). Also marks the
    /// phone verified, since a delivered code proves control of the number.
    async verifyOtp(phone: string, code: string) {
        const user = await this.userByPhone(phone);
        // Same error for "no such phone" and "wrong code": the client maps 400
        // to "invalid code" and learns nothing about which numbers exist.
        if (!user) throw new BadRequestException('Invalid or expired code');

        const token = await this.prisma.phoneVerificationToken.findFirst({
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
            this.prisma.phoneVerificationToken.update({
                where: { id: token.id },
                data: { consumedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    isPhoneVerified: true,
                    phoneVerificationStatus: 'verified',
                    phoneVerificationReason: null,
                    lastSeenAt: new Date(),
                },
            }),
        ]);

        const full = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: { profile: true },
        });
        const tokens = await this.issueTokens(user.id, user.email);
        return { user: this.sanitizeUser(full), ...tokens };
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
        await this.mail.sendCodeEmail(user.email, code, 'verify');

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
        await this.mail.sendCodeEmail(user.email, code, 'reset');

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
            const randomPassword = await this.hash(randomUUID());
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
