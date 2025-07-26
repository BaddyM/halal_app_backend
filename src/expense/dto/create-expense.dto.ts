import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsNumber, IsString } from "class-validator"

export class CreateExpenseDto {
    @ApiProperty({ name: "item", example: "Umeme", type: "string" })
    @IsString()
    @IsNotEmpty()
    item: string;

    @ApiProperty({ name: "amount", example: "20000", type: "number" })
    @IsNumber()
    @IsNotEmpty()
    amount: number
}
