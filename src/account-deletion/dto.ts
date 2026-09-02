import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/// Public form at /delete-account. Deliberately unauthenticated: a member who
/// lost access to their account must still be able to request erasure, which
/// is what the app stores require.
export class CreateDeletionRequestDto {
  @IsEmail() @MaxLength(255) email!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class ConfirmDeletionDto {
  /// true purges the account row immediately; false deactivates it and sets a
  /// 30-day purge window so the member can still appeal.
  @IsOptional() @IsBoolean() hardDelete?: boolean;
}

/// Body for a signed-in member filing their own erasure request.
export class RequestOwnDeletionDto {
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class RejectDeletionDto {
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class ListDeletionRequestsQuery {
  @IsOptional() @IsIn(['pending', 'confirmed', 'rejected', 'all']) status?: string;
}
