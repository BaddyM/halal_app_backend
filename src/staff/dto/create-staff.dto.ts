import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateStaffDto {
    @ApiProperty({ name: "name", example: "Joel" })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ name: "baseSalary", example: "200000", type: "number" })
    @IsNumber()
    @IsNotEmpty()
    baseSalary: number;

    @ApiProperty({ name: "role", example: "ADMIN" })
    @IsString()
    @IsNotEmpty()
    role: string;

    @ApiProperty({ name: "payPeriod", example: "2024-01-01" })
    @IsString()
    @IsOptional()
    payPeriod: string;
}
