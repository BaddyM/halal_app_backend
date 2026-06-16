import {
    IsEmail,
    IsString,
    MinLength,
    IsNotEmpty,
    Length,
    IsOptional,
    IsIn,
    Matches,
} from 'class-validator';

export class SignupDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password!: string;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    password!: string;
}

export class VerifyEmailDto {
    @IsEmail()
    email!: string;

    @IsString()
    @Length(6, 6)
    code!: string;
}

export class ResendVerificationDto {
    @IsEmail()
    email!: string;
}

export class ForgotPasswordDto {
    @IsEmail()
    email!: string;
}

export class ResetPasswordDto {
    @IsEmail()
    email!: string;

    @IsString()
    @Length(6, 6)
    code!: string;

    @IsString()
    @MinLength(6)
    newPassword!: string;
}

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    refreshToken!: string;
}

// E.164-ish phone: optional leading +, 7–15 digits.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export class SendOtpDto {
    @IsString()
    @Matches(PHONE_REGEX, { message: 'Invalid phone number' })
    phone!: string;
}

export class VerifyOtpDto {
    @IsString()
    @Matches(PHONE_REGEX, { message: 'Invalid phone number' })
    phone!: string;

    @IsString()
    @Length(6, 6)
    code!: string;
}

export class OAuthLoginDto {
    // The provider ID token / credential obtained on-device.
    @IsString()
    @IsNotEmpty()
    idToken!: string;

    // Optional display name (Apple only returns it on first sign-in).
    @IsOptional()
    @IsString()
    name?: string;
}
