import { ApiProperty } from "@nestjs/swagger";
import { ServiceList } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateServiceDto {
    @ApiProperty({ name: "service", enum: ["SAUNA", "PARKING", "GARDENS"] })
    @IsEnum(ServiceList, { message: "Please add a known service" })
    @IsNotEmpty()
    service: ServiceList;

    @ApiProperty({name:"customer",type:"string"})
    @IsString()
    @IsOptional()
    customer:string;

    @ApiProperty({name:"phoneNumber",type:"string"})
    @IsString()
    @IsOptional()
    phoneNumber:string;

    @ApiProperty({name:"duration",type:"string"})
    @IsString()
    @IsNotEmpty()
    duration:string;

    @ApiProperty({name:"memo",type:"string"})
    @IsString()
    @IsOptional()
    memo:string;
}
