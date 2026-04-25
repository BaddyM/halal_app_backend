import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseOrderPaymentTerms, PurchaseOrderStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePurchaseOrderDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    orderId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    supplierId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId!: string;

    @ApiProperty()
    @IsNumber()
    @Min(1)
    quantity!: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    unitPrice!: number;

    @ApiPropertyOptional()
    @IsNumber()
    @Min(0)
    @IsOptional()
    amountPaid?: number;

    @ApiPropertyOptional({ enum: PurchaseOrderPaymentTerms })
    @IsEnum(PurchaseOrderPaymentTerms)
    @IsOptional()
    paymentTerms?: PurchaseOrderPaymentTerms;

    @ApiPropertyOptional({ enum: PurchaseOrderStatus })
    @IsEnum(PurchaseOrderStatus)
    @IsOptional()
    status?: PurchaseOrderStatus;
}
