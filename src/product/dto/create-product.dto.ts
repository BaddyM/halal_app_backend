import { ApiProperty, PartialType } from "@nestjs/swagger"
import { ProductCategory, StockTakeStatus } from "@prisma/client"
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator"

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

//Stock taking
export class StockTakeDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    repId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId!: string;

    @ApiProperty()
    @IsEnum(StockTakeStatus, { message: "Please select the correct status" })
    @IsNotEmpty()
    status!: StockTakeStatus;
}

export class UpdateStockTakeDto extends PartialType(StockTakeDto) { }

export class StockTakeItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    stockTakeId!: string;

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

export class UpdateStockTakeItemDto extends PartialType(StockTakeItemDto) { }