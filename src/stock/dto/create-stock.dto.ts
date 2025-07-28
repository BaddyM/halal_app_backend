import { ApiProperty } from "@nestjs/swagger";
import { StockCategory, StockStatus } from "@prisma/client";
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

    @ApiProperty({ name: "UnitPrice", example: "1", type: "number" })
    @IsNumber()
    @IsOptional()
    unit_price: number;

    @ApiProperty({ name: "status", example: "AVAILABLE", type: "string" })
    @IsEnum(StockStatus,{message:"Please select the right status"})
    @IsOptional()
    status: StockStatus;
}
