import { ApiProperty } from "@nestjs/swagger";
import { BankingType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateBankingDto {
    @ApiProperty({ name: "amount", example: "20000" })
    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @ApiProperty({ name: "userId" })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ enum: ["WITHDRAW", "DEPOSIT"] })
    @IsEnum(BankingType, { message: "Check type" })
    @IsNotEmpty()
    type: BankingType;

    @ApiProperty({ name: "memo" })
    @IsString()
    @IsOptional()
    memo?: string;
}
