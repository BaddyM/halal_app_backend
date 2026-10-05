import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AccountDeletionService } from './account-deletion.service';
import { CreateDeletionRequestDto, RequestOwnDeletionDto } from './dto';

/// Public erasure intake. Unauthenticated on purpose — a member locked out of
/// their account must still be able to ask for deletion (App Store / Play
/// requirement), so this is rate-limited rather than guarded.
@Controller('account')
export class AccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @Post('delete-request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDeletion(@Body() dto: CreateDeletionRequestDto) {
    await this.deletion.requestFromPublicForm(dto);
    // Always the same response shape: whether the email belongs to an account
    // must not be observable from this endpoint.
    return {
      success: true,
      message:
        'If an account matches that email, a deletion request has been recorded. We will confirm by email.',
    };
  }
}

/// In-app equivalent for a signed-in member, so Settings → Delete account
/// files a reviewable request instead of silently dropping the row.
@UseGuards(AuthGuard)
@Controller('me/deletion-request')
export class MyAccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: AuthedRequest, @Body() dto: RequestOwnDeletionDto) {
    return this.deletion.requestForUser(req.user.userId, dto.reason);
  }
}
