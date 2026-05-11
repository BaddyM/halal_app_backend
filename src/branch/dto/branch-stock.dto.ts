import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpsertBranchStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class CreateStockTransferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromBranchId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toBranchId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  createdById!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
