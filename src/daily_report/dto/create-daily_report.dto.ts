import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDailyReportDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    notes!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty()
    @IsBoolean()
    @IsOptional()
    isDeleted?: boolean;
}
