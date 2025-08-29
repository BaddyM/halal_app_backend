import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateWebsiteContactDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    fname: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    lname: string;

    @ApiProperty()
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    serviceNeeded: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    eventDate: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    message: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    expectedGuests: string;

    @ApiProperty()
    @IsBoolean()
    @IsOptional()
    isRead: boolean;
}
