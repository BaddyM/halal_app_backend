import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Product website fields
export class UpdateProductWebsiteDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    image?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    featured?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    slug?: string;
}

// Blog
export class CreateBlogDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    slug: string;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    excerpt?: string;

    @ApiProperty()
    @IsString()
    body: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    cover?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    author?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    readMinutes?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}

export class UpdateBlogDto {
    @ApiProperty({ required: false })
    @IsOptional() @IsString() slug?: string;
    @ApiProperty({ required: false })
    @IsOptional() @IsString() title?: string;
    @ApiProperty({ required: false })
    @IsOptional() @IsString() excerpt?: string;
    @ApiProperty({ required: false })
    @IsOptional() @IsString() body?: string;
    @ApiProperty({ required: false })
    @IsOptional() @IsString() cover?: string;
    @ApiProperty({ required: false })
    @IsOptional() @IsString() date?: string;
    @ApiProperty({ required: false })
    @IsOptional() @IsString() author?: string;
    @ApiProperty({ required: false })
    @IsOptional() @Type(() => Number) @IsInt() readMinutes?: number;
    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Testimonial
export class CreateTestimonialDto {
    @ApiProperty() @IsString() @MinLength(1) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() role?: string;
    @ApiProperty() @IsString() @MinLength(1) quote: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() image?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateTestimonialDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() role?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() quote?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() image?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Faq
export class CreateFaqDto {
    @ApiProperty() @IsString() @MinLength(1) question: string;
    @ApiProperty() @IsString() @MinLength(1) answer: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateFaqDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() question?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() answer?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Company Value
export class CreateCompanyValueDto {
    @ApiProperty({ required: false, default: 'Sparkles' }) @IsOptional() @IsString() icon?: string;
    @ApiProperty() @IsString() @MinLength(1) title: string;
    @ApiProperty() @IsString() @MinLength(1) description: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateCompanyValueDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() icon?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Company Stat
export class CreateCompanyStatDto {
    @ApiProperty() @IsString() @MinLength(1) value: string;
    @ApiProperty() @IsString() @MinLength(1) label: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateCompanyStatDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() value?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() label?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Other Service (printing, stationery, deliveries, ...)
export class CreateOtherServiceDto {
    @ApiProperty({ required: false, default: 'Sparkles' }) @IsOptional() @IsString() icon?: string;
    @ApiProperty() @IsString() @MinLength(1) title: string;
    @ApiProperty() @IsString() @MinLength(1) description: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateOtherServiceDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() icon?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Featured Picks
export class CreateFeaturedPickDto {
    @ApiProperty() @IsString() @MinLength(1) productId: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateFeaturedPickDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() productId?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// How It Works Videos
export class CreateHowItWorksVideoDto {
    @ApiProperty() @IsString() @MinLength(1) title: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
    @ApiProperty() @IsString() @MinLength(1) url: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() thumbnail?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() category?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() durationSec?: number;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateHowItWorksVideoDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() url?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() thumbnail?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() category?: string;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() durationSec?: number;
    @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPublished?: boolean;
}

// Site Settings — bulk upsert
export class UpsertSiteSettingsDto {
    @ApiProperty({ description: 'key/value pairs', example: { siteName: 'Jubra', tagline: '...' } })
    settings: Record<string, string>;
}

// Inquiry status
export enum InquiryStatusDto {
    NEW = 'NEW',
    SEEN = 'SEEN',
    HANDLED = 'HANDLED',
}

export class UpdateInquiryStatusDto {
    @ApiProperty({ enum: InquiryStatusDto })
    @IsEnum(InquiryStatusDto)
    status: InquiryStatusDto;
}
