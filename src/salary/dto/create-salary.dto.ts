import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSalaryDto {
    @ApiProperty({ name: "staffId" })
    @IsString()
    @IsNotEmpty()
    staffId: string;

    @ApiProperty({ name: "amountPaid", type: "number" })
    @IsString()
    @IsNotEmpty()
    amountPaid: number;

    @ApiProperty({ name: "period", example:"January" })
    @IsString()
    @IsNotEmpty()
    period: string;
}
