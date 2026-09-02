import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
  // Accepts both the stored vocabulary and the admin console's three-state one
  // ('pending' → waitingForUser); SupportService normalises before writing.
  @IsOptional()
  @IsIn(['open', 'inProgress', 'waitingForUser', 'resolved', 'closed', 'pending'])
  status?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
}

/// Public help form (no account). `message` carries the ticket body and the
/// reporter is identified by name/email rather than a userId.
export class CreatePublicSupportTicketDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsIn(['account', 'matches', 'billing', 'safety', 'bug', 'other']) category!: string;
  @IsString() @MinLength(3) @MaxLength(150) subject!: string;
  @IsString() @MinLength(10) @MaxLength(2000) message!: string;
}
