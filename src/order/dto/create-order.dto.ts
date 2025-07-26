import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateOrderDto {
    @ApiProperty({ name: "customer", type: "string" })
    @IsString()
    @IsOptional()
    customer: string;

    @ApiProperty({ name: "table", type: "string" })
    @IsString()
    @IsNotEmpty()
    table: string;

    @ApiProperty({ name: "items", type: "string" })
    @IsString()
    @IsNotEmpty()
    items: string;
}
