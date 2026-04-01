import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateBranchDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name!:string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    address?:string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    contact?:string;

    @ApiProperty()
    @IsBoolean()
    @IsOptional()
    isActive?:boolean;
}
