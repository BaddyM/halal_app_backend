import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMethod } from './create-sale.dto';

export class CreateReturnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  saleId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  refundAmount!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ enum: PaymentMethod, required: false })
  @IsEnum(PaymentMethod)
  @IsOptional()
  refundMethod?: PaymentMethod;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  approvedById!: string;
}

export class UpdateReturnDto extends PartialType(CreateReturnDto) {}
