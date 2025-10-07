import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class TogglePernmission {
    @ApiProperty()
    @IsString()
    @IsOptional()
    id: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    page: string;

    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty()
    @IsBoolean()
    @IsNotEmpty()
    isActive: boolean;
}
