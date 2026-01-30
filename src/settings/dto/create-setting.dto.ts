import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateSettingDto { }

export class SendWelcomeMailDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    email: string;
}

export class SendLoginMailDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    email: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    device: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    ipAddress: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    timestamp: string;
}
