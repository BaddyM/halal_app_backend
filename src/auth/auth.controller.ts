import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard, AuthedRequest } from './auth.guard';
import {
    SignupDto,
    LoginDto,
    VerifyEmailDto,
    ResendVerificationDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    RefreshTokenDto,
    OAuthLoginDto,
    SendOtpDto,
    VerifyOtpDto,
} from './dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    // 30/min globally was ~1800 password guesses an hour per IP. These are
    // per-IP and deliberately NAT-tolerant; a per-account lockout is the
    // stronger control and is still outstanding.
    @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
    @Post('signup')
    signup(@Body() dto: SignupDto) {
        return this.auth.signup(dto.name, dto.email, dto.password);
    }

    @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
    @Post('register')
    register(@Body() dto: SignupDto) {
        return this.auth.signup(dto.name, dto.email, dto.password);
    }

    @Throttle({ default: { ttl: 300_000, limit: 20 } })
    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    /// Passwordless phone login. Tightly throttled: sending costs real SMS
    /// money, and verify is the brute-force surface for a 6-digit code.
    @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
    @Post('otp/send')
    @HttpCode(HttpStatus.OK)
    sendOtp(@Body() dto: SendOtpDto) {
        return this.auth.sendOtp(dto.phone);
    }

    @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
    @Post('otp/verify')
    @HttpCode(HttpStatus.OK)
    verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.auth.verifyOtp(dto.phone, dto.code);
    }

    @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
    @Post('verify-email')
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.auth.verifyEmail(dto.email, dto.code);
    }

    @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
    @Post('resend-verification')
    resendVerification(@Body() dto: ResendVerificationDto) {
        return this.auth.resendVerification(dto.email);
    }

    @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.auth.forgotPassword(dto.email);
    }

    @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
    }

    @Post('oauth/google')
    oauthGoogle(@Body() dto: OAuthLoginDto) {
        return this.auth.oauthGoogle(dto.idToken);
    }

    @Post('oauth/apple')
    oauthApple(@Body() dto: OAuthLoginDto) {
        return this.auth.oauthApple(dto.idToken, dto.name);
    }

    @Post('refresh')
    refresh(@Body() dto: RefreshTokenDto) {
        return this.auth.refresh(dto.refreshToken);
    }

    @Post('logout')
    @UseGuards(AuthGuard)
    logout(@Body() dto: RefreshTokenDto) {
        return this.auth.logout(dto.refreshToken);
    }

    @Get('me')
    @UseGuards(AuthGuard)
    me(@Req() req: AuthedRequest) {
        return { userId: req.user.userId, email: req.user.email };
    }
}
