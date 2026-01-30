import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({ name: "email", type: "string", example: "demo@gmail.com" })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ name: "password", type: "string", example: "123" })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({ name: "fcmToken", type: "string", example: "xxxxxxxxxxxxxxxxxxxxxxxxx" })
    @IsString()
    @IsNotEmpty()
    fcmToken: string;

    @ApiProperty({ name: "device", type: "string", example: "Web" })
    @IsString()
    @IsOptional()
    device?: string;

    @ApiProperty({ name: "ipAddress", type: "string", example: "0.0.0.0" })
    @IsString()
    @IsOptional()
    ipAddress?: string;
}