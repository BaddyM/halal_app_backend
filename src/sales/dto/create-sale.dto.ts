import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  MOBILE_MONEY = 'MOBILE_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
}
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
  @IsOptional()
  productId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  itemName?: string;

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

  @ApiProperty({ enum: PaymentMethod, required: false })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

export class CreateMultipleSaleDto {
  @ApiProperty({ type: [CreateSaleDto] }) // Tells Swagger it's an array
  @IsArray()
  @ValidateNested({ each: true }) // Validates every object inside the array
  @Type(() => CreateSaleDto) // Necessary for class-transformer to "see" the child DTO
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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;
}

export class UpdateCreditSaleDto extends PartialType(CreditSaleDto) {}

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

  @ApiProperty({ enum: PaymentMethod, required: false })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reference?: string;
}

export class UpdateCreditSalePaymentDto extends PartialType(
  CreditSalePaymentDto,
) {}
