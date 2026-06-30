import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// ── Subscriptions / plan tiers ─────────────────────────────────
const TIERS = ['basic', 'premium', 'vip'];
const SUB_PROVIDERS = ['stripe', 'apple', 'google', 'manual'];
const SUB_STATUSES = ['active', 'canceled', 'expired', 'pending'];

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
  @IsOptional() @IsIn(['male', 'female']) gender?: 'male' | 'female';
}

export class UpdateMeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @IsNotEmpty() email?: string;
  @IsOptional() @IsString() @MaxLength(200) password?: string;
}

// Full admin-side user update — basic account fields + profile details.
export class AdminUpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @IsNotEmpty() email?: string;
  @IsOptional() @IsString() @MaxLength(200) password?: string;
  @IsOptional() @IsIn(['user', 'admin']) role?: 'user' | 'admin';
  @IsOptional() @IsIn(['active', 'pending', 'suspended', 'banned']) status?: string;
  @IsOptional() @IsIn(['male', 'female']) gender?: 'male' | 'female';
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(120) profession?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
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

// ── Plans (subscription packages) ──────────────────────────────
export class CreatePlanDto {
  @IsIn(TIERS) tier!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsIn(['month', 'year', 'once']) interval?: string;
  @IsOptional() @IsArray() features?: string[];
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdatePlanDto {
  @IsOptional() @IsIn(TIERS) tier?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsIn(['month', 'year', 'once']) interval?: string;
  @IsOptional() @IsArray() features?: string[];
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// ── Subscriptions ──────────────────────────────────────────────
export class AttachSubscriptionDto {
  @IsString() @IsNotEmpty() userId!: string;
  @IsString() @IsNotEmpty() planId!: string;
  @IsOptional() @IsIn(SUB_PROVIDERS) provider?: string;
  @IsOptional() @IsIn(SUB_STATUSES) status?: string;
  @IsOptional() @IsDateString() currentPeriodEnd?: string;
  @IsOptional() @IsBoolean() cancelAtPeriodEnd?: boolean;
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsIn(SUB_PROVIDERS) provider?: string;
  @IsOptional() @IsIn(SUB_STATUSES) status?: string;
  @IsOptional() @IsDateString() currentPeriodEnd?: string;
  @IsOptional() @IsBoolean() cancelAtPeriodEnd?: boolean;
}

// ── Islamic settings ───────────────────────────────────────────
export class UpdateIslamicSettingsDto {
  @IsOptional() @IsBoolean() prayerTimesEnabled?: boolean;
  @IsOptional() @IsBoolean() qiblaEnabled?: boolean;
  @IsOptional() @IsBoolean() dailyContentEnabled?: boolean;
  @IsOptional() @IsBoolean() tasbihEnabled?: boolean;
  @IsOptional() @IsBoolean() ramadanMode?: boolean;
  @IsOptional() @IsIn(['MWL', 'ISNA', 'Egypt', 'Makkah', 'Karachi']) calcMethod?: string;
}
