import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StartConversationDto {
    @IsString()
    @IsNotEmpty()
    otherUserId!: string;
}

export class SendMessageDto {
    // Allowed empty for media messages; text messages are validated server-side.
    @IsString()
    @MaxLength(2000)
    text!: string;

    // 'text' (default) | 'image' | 'voice'. Non-text is premium-only.
    @IsOptional()
    @IsIn(['text', 'image', 'voice'])
    type?: 'text' | 'image' | 'voice';

    @IsOptional()
    @IsString()
    mediaUrl?: string;
}

export class MessagesQueryDto {
    /// ISO-8601 timestamp. Returns messages older than this.
    @IsOptional()
    @IsString()
    before?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}

export class SendToUserDto {
    @IsString()
    @IsNotEmpty()
    otherUserId!: string;

    @IsString()
    @MaxLength(2000)
    text!: string;

    @IsOptional()
    @IsIn(['text', 'image', 'voice'])
    type?: 'text' | 'image' | 'voice';

    @IsOptional()
    @IsString()
    mediaUrl?: string;
}
