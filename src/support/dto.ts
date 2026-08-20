import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString() @MinLength(3) @MaxLength(160) subject!: string;
  @IsOptional() @IsIn(['general', 'account', 'safety', 'billing', 'technical', 'ai']) category?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

export class ReplySupportTicketDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}  

export class UpdateSupportTicketDto {
  @IsOptional() @IsIn(['open', 'inProgress', 'waitingForUser', 'resolved', 'closed']) status?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
}
