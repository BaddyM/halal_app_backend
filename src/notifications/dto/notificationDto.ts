import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class NotificationsDto {    
    @ApiProperty({ name: "title" })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ name: "body" })
    @IsString()
    @IsNotEmpty()
    body: string;
}