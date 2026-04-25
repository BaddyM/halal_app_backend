import { ApiProperty, PartialType } from "@nestjs/swagger"
import { ProductCategory } from "@prisma/client"
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator"
import { Type } from 'class-transformer';

export class CreateProductDto {
    @ApiProperty()
    @IsEnum(ProductCategory, { message: "Please select the correct category" })
    @IsNotEmpty()
    category!: ProductCategory;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    price!: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    totalStock!: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    classLevel?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    subject?: string;
}

export class StockTakeItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantityTaken!: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantitySold!: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantityReturned!: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    revenue!: number;
}

export class CreateStockTakeDto {
    @ApiProperty({ type: [StockTakeItemDto] }) // Tells Swagger it's an array
    @IsArray()
    @ValidateNested({ each: true }) // Validates every object inside the array
    @Type(() => StockTakeItemDto)   // Necessary for class-transformer to "see" the child DTO
    items!: StockTakeItemDto[];
}

export class UpdateStockTakeItemDto extends PartialType(StockTakeItemDto) { }