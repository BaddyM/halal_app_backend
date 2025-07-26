import { ApiProperty } from "@nestjs/swagger";
import { StockCategory } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateStockDto {
    @ApiProperty({ name: "item", example: "tomato" })
    @IsString()
    @IsNotEmpty()
    item: string;

    @ApiProperty({ enum: ["PRODUCE", "DRY_GOODS", "DRINKS", "MEAT", "OTHERS"] })
    @IsEnum(StockCategory, { message: "Category must be correct" })
    @IsNotEmpty()
    category: StockCategory;

    @ApiProperty({ name: "qty", example: "1", type: "number" })
    @IsNumber()
    @IsNotEmpty()
    qty: number;

    @ApiProperty({ name: "unit_price", example: "1", type: "number" })
    @IsNumber()
    @IsOptional()
    unit_price: number;
}
