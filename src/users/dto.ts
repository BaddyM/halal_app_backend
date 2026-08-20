import { Type } from 'class-transformer';
import {
    Allow,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import {
    Gender,
    PrayerFrequency,
    IslamicSect,
    HijabPreference,
    MarriageTimeline,
    ChildrenPreference,
    LocationPreference,
    SubscriptionPlan,
} from '@prisma/client';

export class UpdateProfileDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsEnum(Gender) gender?: Gender;
    @IsOptional() @IsDateString() dateOfBirth?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() country?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() profession?: string;
    @IsOptional() @IsString() bio?: string;
    @IsOptional() @IsString() primaryImageUrl?: string;

    @IsOptional() @IsEnum(PrayerFrequency) prayerFrequency?: PrayerFrequency;
    @IsOptional() @IsEnum(IslamicSect) sect?: IslamicSect;
    @IsOptional() @IsEnum(HijabPreference) hijabPreference?: HijabPreference;
    @IsOptional() @Type(() => Boolean) @IsBoolean() hasBeard?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() prefersBeard?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() prefersHijab?: boolean;

    @IsOptional() @IsString() ethnicity?: string;
    @IsOptional() @IsEnum(MarriageTimeline) maritalTimeline?: MarriageTimeline;
    @IsOptional() @IsEnum(ChildrenPreference) childrenPref?: ChildrenPreference;
    @IsOptional() @IsEnum(LocationPreference) locationPref?: LocationPreference;

    @IsOptional() @Type(() => Boolean) @IsBoolean() prayerTimesEnabled?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() halalVerificationSubmitted?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() readReceiptsEnabled?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() showOnlineStatus?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() showLastSeen?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() showDistance?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() incognitoMode?: boolean;
    @IsOptional() @IsString() profileVisibility?: string;

    @IsOptional() @IsArray() values?: string[];
    @IsOptional() @IsArray() interests?: string[];
}

export class OnboardingAnswerDto {
    @IsString() questionId!: string;
    // String or array of strings — accepted as-is into JSON column.
    // @Allow() prevents the global ValidationPipe whitelist from stripping it.
    @Allow()
    answer!: string | string[];
}

export class SubmitOnboardingDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OnboardingAnswerDto)
    answers!: OnboardingAnswerDto[];
}

export class ChangePlanDto {
    @IsEnum(SubscriptionPlan) plan!: SubscriptionPlan;
}

export class DiscoverQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(18) @Max(100) minAge?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(18) @Max(100) maxAge?: number;
    @IsOptional() @IsString() location?: string;
    @IsOptional() @IsEnum(PrayerFrequency) prayerFrequency?: PrayerFrequency;
    @IsOptional() @Type(() => Boolean) @IsBoolean() wearsHijab?: boolean;
    @IsOptional() @IsEnum(IslamicSect) sect?: IslamicSect;
    @IsOptional() @Type(() => Boolean) @IsBoolean() verifiedOnly?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() onlineOnly?: boolean;
    @IsOptional() @IsString() search?: string;
    // Comma-separated interest tags; a candidate matches if it shares ANY of them.
    @IsOptional() @IsString() interests?: string;
    @IsOptional() @IsString() sortBy?: 'compatibility' | 'age' | 'name';
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class LikeProfileDto {
    @IsString() toUserId!: string;
    @IsEnum(['like', 'superLike', 'pass'] as const)
    type!: 'like' | 'superLike' | 'pass';
}

export class ReportUserDto {
    @IsString() reason!: string;
    @IsOptional() @IsString() @MaxLength(2000) details?: string;
}

export class SetWaliDto {
    @IsString() @MaxLength(120) waliName!: string;
    @IsOptional() @IsString() @MaxLength(120) waliEmail?: string;
    @IsOptional() @IsString() @MaxLength(32) waliPhone?: string;
    @IsOptional() @IsString() @MaxLength(60) waliRelation?: string;
}

export class UpdatePhotoDto {
    @IsOptional() @Type(() => Boolean) @IsBoolean() isPrivate?: boolean;
    @IsOptional() @Type(() => Boolean) @IsBoolean() isPrimary?: boolean;
}

export class DeleteAccountDto {
    @IsString() password!: string;
    @Type(() => Boolean) @IsBoolean() confirm!: boolean;
}
