import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateUserDto {
    @ApiProperty({ name: "name", type: "string", example: "demo" })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ name: "email", type: "string", example: "demo@gmail.com" })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ name: "password", type: "string", example: "xxxxxxxxxxxxxx" })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({name:"role", enum: ['ADMIN', 'BAR', 'SAUNA', 'PARKING', 'KITCHEN'] })
    @IsEnum(Role, { message: "Please add a valid role." })
    @IsNotEmpty()
    role: Role;
}
