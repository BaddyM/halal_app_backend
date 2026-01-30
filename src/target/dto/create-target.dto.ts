import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, isEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export enum TransactionReason {
    DEBIT = "DEBIT",
    CREDIT = "CREDIT"
}

export class CreateTargetDto {
    @ApiProperty({ name: "userId" })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ name: "targetLabel" })
    @IsString()
    @IsOptional()
    targetLabel?: string;

    @ApiProperty({ name: "amount", example: 20000 })
    @IsNumber()
    @IsNotEmpty()
    amount: number;
}

export class CreateTargetTransactionDto {
    @ApiProperty({ name: "targetId" })
    @IsString()
    @IsNotEmpty()
    targetId: string;

    @ApiProperty({ name: "amount", example: 20000 })
    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @ApiProperty({ name: "reason" })
    @IsEnum(TransactionReason, { message: "Use the correct transaction reason" })
    @IsNotEmpty()
    reason: TransactionReason;
}
