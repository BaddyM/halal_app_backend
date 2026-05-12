import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductionDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	productId!: string;

	@ApiProperty()
	@IsNumber()
	@IsNotEmpty()
	quantity!: number;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	note?: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	createdById?: string;
}
