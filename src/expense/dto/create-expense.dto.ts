import { ApiProperty } from "@nestjs/swagger";
import { ExpenseCategory } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateExpenseDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @ApiProperty()
    @IsEnum(ExpenseCategory, { message: "Please select the correct category" })
    @IsNotEmpty()
    category!: ExpenseCategory;
}
