import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateWebsiteBlogDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    image: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    section: string;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    isActive: boolean;
}
