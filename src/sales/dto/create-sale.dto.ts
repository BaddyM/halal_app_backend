import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateSaleDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    repId!: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    stockTakeId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantity!: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    customerId?: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    unitPrice!: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    memo?: string;

    @ApiProperty()
    @IsBoolean()
    @IsNotEmpty()
    onCredit?: boolean;
}

export class CreditSaleDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    orderId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @ApiProperty()
    @IsBoolean()
    @IsOptional()
    isDeleted?: boolean;
}

export class UpdateCreditSaleDto extends PartialType(CreditSaleDto) { }

export class CreditSalePaymentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    orderId!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    paid!: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userId!: string;
}

export class UpdateCreditSalePaymentDto extends PartialType(CreditSalePaymentDto) { }