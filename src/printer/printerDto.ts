import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty } from "class-validator";

export class PrinterDto {
    @ApiProperty({ name: "paymentId", example: "xxxxxxxxxxxxxxxxxxx" })
    @IsArray()
    @IsNotEmpty()
    paymentId: string[];
}