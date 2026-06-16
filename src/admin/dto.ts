import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// ── Users ──────────────────────────────────────────────────────
const PRACTICE_LABELS = ['Highly Practicing', 'Practicing', 'Moderately', 'Learning'];

export class AdminUserQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['active', 'pending', 'suspended', 'banned']) status?: string;
  @IsOptional() @IsIn(PRACTICE_LABELS) practice?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() verified?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() premium?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsString() @IsNotEmpty() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
  @IsOptional() @IsIn(['user', 'admin']) role?: 'user' | 'admin';
  @IsOptional() @IsIn(['active', 'pending', 'suspended', 'banned']) status?: string;
}

export class UpdateMeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @IsNotEmpty() email?: string;
  @IsOptional() @IsString() @MaxLength(200) password?: string;
}

export class SetUserStatusDto {
  @IsIn(['active', 'pending', 'suspended', 'banned']) status!:
    | 'active'
    | 'pending'
    | 'suspended'
    | 'banned';
}

export class VerifyUserDto {
  @IsBoolean() verified!: boolean;
}

export class AdminMessageDto {
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) body!: string;
}

export class BroadcastDto {
  @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) message!: string;
  // all | free | premium
  @IsOptional() @IsIn(['all', 'free', 'premium']) audience?: string;
}

export class SendBulkMessageDto {
  // Either explicit user ids, an audience segment, or both.
  @IsOptional() @IsArray() userIds?: string[];
  @IsOptional() @IsIn(['all', 'free', 'premium', 'banned', 'verified']) audience?: string;
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) body!: string;
}

// ── Reports ────────────────────────────────────────────────────
export class ResolveReportDto {
  @IsIn(['reviewed', 'resolved', 'dismissed']) status!:
    | 'reviewed'
    | 'resolved'
    | 'dismissed';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

// ── Ads ────────────────────────────────────────────────────────
const PLACEMENTS = ['HOME_BANNER', 'BETWEEN_MATCHES', 'CHAT_TOP', 'PROFILE_SIDEBAR'];
const AUDIENCES = ['ALL', 'FREE', 'PREMIUM'];

export class CreateAdDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() ctaText?: string;
  @IsOptional() @IsString() targetUrl?: string;
  @IsIn(PLACEMENTS) placement!: string;
  @IsOptional() @IsIn(AUDIENCES) audience?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateAdDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() ctaText?: string;
  @IsOptional() @IsString() targetUrl?: string;
  @IsOptional() @IsIn(PLACEMENTS) placement?: string;
  @IsOptional() @IsIn(AUDIENCES) audience?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// ── Plans ──────────────────────────────────────────────────────
export class UpdatePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() interval?: string;
  @IsOptional() @IsArray() features?: string[];
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// ── Islamic settings ───────────────────────────────────────────
export class UpdateIslamicSettingsDto {
  @IsOptional() @IsBoolean() prayerTimesEnabled?: boolean;
  @IsOptional() @IsBoolean() qiblaEnabled?: boolean;
  @IsOptional() @IsBoolean() dailyContentEnabled?: boolean;
  @IsOptional() @IsBoolean() ramadanMode?: boolean;
  @IsOptional() @IsIn(['MWL', 'ISNA', 'Egypt', 'Makkah', 'Karachi']) calcMethod?: string;
}
