import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyDto {
  @IsString() @IsNotEmpty() @MaxLength(4000) body!: string;
}
