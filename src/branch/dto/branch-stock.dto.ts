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

  @ApiProperty({ required: false, description: 'Mark transfer as credit (true) so a payable is created)' })
  @IsOptional()
  onCredit?: boolean;

  @ApiProperty({ required: false, description: 'Total cost for the transferred products (required when onCredit=true)' })
  @IsOptional()
  totalAmount?: number;
}

export class TransferItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateBulkStockTransferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromBranchId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toBranchId!: string;

  @ApiProperty({ type: [TransferItemDto] })
  items!: TransferItemDto[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  createdById!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  onCredit?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
