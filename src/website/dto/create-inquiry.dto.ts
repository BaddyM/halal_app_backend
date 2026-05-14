import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum InquiryTypeDto {
    CART = 'CART',
    CONTACT = 'CONTACT',
}

export class CreateInquiryDto {
    @ApiProperty({ enum: InquiryTypeDto })
    @IsEnum(InquiryTypeDto)
    type: InquiryTypeDto;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(180)
    email?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    message?: string;

    @ApiProperty({ required: false, description: 'JSON-serialisable structured data (e.g. cart contents).' })
    @IsOptional()
    payload?: unknown;
}
