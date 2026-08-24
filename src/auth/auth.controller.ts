import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
} from './dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Post('signup')
    signup(@Body() dto: SignupDto) {
        return this.auth.signup(dto.name, dto.email, dto.password);
    }

    @Post('register')
    register(@Body() dto: SignupDto) {
        return this.auth.signup(dto.name, dto.email, dto.password);
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    @Post('verify-email')
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.auth.verifyEmail(dto.email, dto.code);
    }

    @Post('resend-verification')
    resendVerification(@Body() dto: ResendVerificationDto) {
        return this.auth.resendVerification(dto.email);
    }

    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.auth.forgotPassword(dto.email);
    }

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
