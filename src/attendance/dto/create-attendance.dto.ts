import { ApiProperty } from "@nestjs/swagger";
import { AttendanceStatus } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAttendanceDto {
    @ApiProperty({ name: "userId", type: "string" })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ name: "status", enum: ["PRESENT", "ABSENT"] })
    @IsEnum(AttendanceStatus, { message: "Please select either PRESENT or ABSENT" })
    @IsNotEmpty()
    status: AttendanceStatus;

    @ApiProperty({ name: "memo", type: "string" })
    @IsString()
    @IsOptional()
    memo: string;
}
