import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateSupplierOwnedProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsNumber()
  price!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  memo?: string;
}

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  memo?: string;

  @ApiPropertyOptional({ type: [CreateSupplierOwnedProductDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierOwnedProductDto)
  @IsOptional()
  products?: CreateSupplierOwnedProductDto[];
}
