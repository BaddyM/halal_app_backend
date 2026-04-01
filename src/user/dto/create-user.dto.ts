import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum UserRole {
    admin = "admin",
    office = "office",
    sales_rep = "sales_rep"
}

export class CreateUserDto {
    @ApiProperty({ name: "name", type: "string", example: "john" })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ name: "accessToken" })
    @IsString()
    @IsOptional()
    accessToken?: string;

    @ApiProperty({ name: "email", type: "string", example: "demo@gmail.com" })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ name: "password", type: "string", example: "xxxxxxxxxxxxxx" })
    @IsString()
    @IsNotEmpty()
    password!: string;

    @ApiProperty({ name: "branchId", type: "string" })
    @IsString()
    @IsNotEmpty()
    branchId!: string;

    @ApiProperty({ name: "role" })
    @IsEnum(UserRole, { message: "Please add a valid role." })
    @IsNotEmpty()
    role!: UserRole;

    @ApiProperty({ name: "isActive", type: "boolean" })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class CustomerDto {
    @ApiProperty({ name: "name", type: "string", example: "john" })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ name: "email", type: "string" })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ name: "phoneNumber", type: "string" })
    @IsString()
    @IsNotEmpty()
    phoneNumber!: string;

    @ApiProperty({ name: "address", type: "string", example: "kampala" })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty({ name: "branchId", type: "string" })
    @IsString()
    @IsNotEmpty()
    branchId!: string;

    @ApiProperty({ name: "isDeleted", type: "boolean" })
    @IsBoolean()
    @IsOptional()
    isDeleted?: boolean;
}

export class UpdateCustomerDto extends PartialType(CustomerDto) { }