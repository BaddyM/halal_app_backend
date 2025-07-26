import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateSalaryDto {
    @ApiProperty({ name: "staffId" })
    @IsString()
    @IsNotEmpty()
    staffId: string;

    @ApiProperty({ name: "amountPaid", type: "number" })
    @IsNumber()
    @IsNotEmpty()
    amountPaid: number;

    @ApiProperty({ name: "period", example:"January" })
    @IsString()
    @IsNotEmpty()
    period: string;
}
