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

export class SendOtpDto {
    // Lenient on formatting (users type spaces/dashes); normalised server-side
    // before lookup so "+1 555 0100" and "+15550100" resolve to one account.
    @IsString()
    @Matches(/^[+]?[\d\s()-]{6,20}$/, { message: 'phone must be a valid phone number' })
    phone!: string;
}

export class VerifyOtpDto {
    @IsString()
    @Matches(/^[+]?[\d\s()-]{6,20}$/, { message: 'phone must be a valid phone number' })
    phone!: string;

    @IsString()
    @Length(6, 6)
    code!: string;
}
