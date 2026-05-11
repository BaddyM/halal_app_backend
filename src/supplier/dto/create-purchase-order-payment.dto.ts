import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePurchaseOrderPaymentDto {
    @ApiProperty()
    @IsNumber()
    @Min(0.01)
    amount!: number;

    @ApiPropertyOptional({ enum: PaymentMethod })
    @IsEnum(PaymentMethod)
    @IsOptional()
    method?: PaymentMethod;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    reference?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    note?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    paidAt?: string;
}
