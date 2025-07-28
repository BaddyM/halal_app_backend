import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePaymentDto {
    @ApiProperty({ name: "orderId", type: "string", example:"xxxxxxxxxxxxx" })
    @IsString()
    @IsOptional()
    orderId: string;

    @ApiProperty({ name: "serviceId", type: "string", example:"xxxxxxxxxxxx" })
    @IsString()
    @IsOptional()
    serviceId: string;

    @ApiProperty({ name: "paid", type: "number", example:"20000" })
    @IsNumber()
    @IsNotEmpty()
    paid: number;
}
