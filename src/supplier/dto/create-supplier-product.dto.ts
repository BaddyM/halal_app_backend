import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSupplierProductDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    supplierId!: string;

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
