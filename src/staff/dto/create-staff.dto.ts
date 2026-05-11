import { ApiProperty, PartialType } from "@nestjs/swagger";
import { SalaryStatus } from "@prisma/client";
import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateStaffDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiProperty()
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    role!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    baseSalary!: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId!: string;
}

export class CreateSalaryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    staffId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    period!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @ApiProperty()
    @IsEnum(SalaryStatus, { message: "Please select the correct status" })
    @IsOptional()
    status?: SalaryStatus;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    allowances?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    deductions?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    advanceDeducted?: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    memo?: string;
}

export class UpdateSalaryDto extends PartialType(CreateSalaryDto) { }

export class CreateSalaryAdvanceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    staffId!: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    reason?: string;
}