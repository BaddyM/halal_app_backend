import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from 'class-transformer';
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
    @IsOptional()
    memo?: string;

    @ApiProperty()
    @IsBoolean()
    @IsNotEmpty()
    onCredit?: boolean;
}

export class CreateMultipleSaleDto {
    @ApiProperty({ type: [CreateSaleDto] }) // Tells Swagger it's an array
    @IsArray()
    @ValidateNested({ each: true }) // Validates every object inside the array
    @Type(() => CreateSaleDto)   // Necessary for class-transformer to "see" the child DTO
    items!: CreateSaleDto[];
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