import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateUserDto {
    @ApiProperty({ name: "firstName", type: "string", example: "john" })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ name: "lastName", type: "string", example: "doe" })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ name: "phoneNumber", type: "string", example: "+256781181958" })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @ApiProperty({ name: "gender" })
    @IsString()
    @IsNotEmpty()
    gender: string;

    @ApiProperty({ name: "nationalId" })
    @IsString()
    @IsOptional()
    nationalId?: string;

    @ApiProperty({ name: "maritalStatus" })
    @IsString()
    @IsOptional()
    maritalStatus?: string;

    @ApiProperty({ name: "streetAddress" })
    @IsString()
    @IsOptional()
    streetAddress?: string;

    @ApiProperty({ name: "city" })
    @IsString()
    @IsNotEmpty()
    city: string;

    @ApiProperty({ name: "district" })
    @IsString()
    @IsNotEmpty()
    district: string;

    @ApiProperty({ name: "occupation" })
    @IsString()
    @IsOptional()
    occupation?: string;

    @ApiProperty({ name: "secondaryPhoneNumber" })
    @IsString()
    @IsOptional()
    secondaryPhoneNumber?: string;

    @ApiProperty({ name: "profilePicture" })
    @IsString()
    @IsOptional()
    profilePicture?: string;

    @ApiProperty({ name: "accessToken" })
    @IsString()
    @IsOptional()
    accessToken?: string;

    @ApiProperty({ name: "fcmToken" })
    @IsString()
    @IsOptional()
    fcmToken?: string;

    @ApiProperty({ name: "email", type: "string", example: "demo@gmail.com" })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ name: "password", type: "string", example: "xxxxxxxxxxxxxx" })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({ name: "role", enum: ['ADMIN', 'SUPER_ADMIN', 'MOBILE_APP'] })
    @IsEnum(Role, { message: "Please add a valid role." })
    @IsNotEmpty()
    role: Role;

    @ApiProperty({ name: "isActive", type: "boolean" })
    @IsBoolean()
    @IsOptional()
    isActive: boolean;

    @ApiProperty({ name: "Web" })
    @IsString()
    @IsOptional()
    devices?: string;
}
