import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({ name: "email", type: "string", example: "demo@gmail.com" })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ name: "password", type: "string", example: "123" })
    @IsString()
    @IsNotEmpty()
    password: string;
}