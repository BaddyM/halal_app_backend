import { ApiProperty } from "@nestjs/swagger";
import { ServiceList, ServiceStatus } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateServiceDto {
    @ApiProperty({ name: "service", enum: ["SAUNA", "PARKING", "GARDENS", "ACCOMODATION", "OTHER"] })
    @IsEnum(ServiceList, { message: "Please add a known service" })
    @IsNotEmpty()
    service: ServiceList;

    @ApiProperty({ name: "customer", type: "string" })
    @IsString()
    @IsOptional()
    customer: string;

    @ApiProperty({ name: "phoneNumber", type: "string" })
    @IsString()
    @IsOptional()
    phoneNumber: string;

    @ApiProperty({ name: "amount", type: "number" })
    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @ApiProperty({ name: "duration", type: "string" })
    @IsString()
    @IsNotEmpty()
    duration: string;

    @ApiProperty({ name: "memo", type: "string" })
    @IsString()
    @IsOptional()
    memo?: string;

    @ApiProperty({ enum: ["PAID", "PENDING", "CANCELLED"] })
    @IsEnum(ServiceStatus, { message: "Select a service" })
    @IsOptional()
    status: ServiceStatus;
}
