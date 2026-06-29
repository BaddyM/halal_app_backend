import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { UsersService } from 'src/users/users.service';

/// Spec-aligned matching endpoints (`/matches/...`). `:id` is the other user's
/// id. Accept/reject operate on incoming interests; these reuse the existing
/// like/match logic in UsersService.
@UseGuards(AuthGuard)
@Controller('matches')
export class MatchesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    return this.users.matchesByStatus(req.user.userId, status);
  }

  @Get('summary')
  summary(@Req() req: AuthedRequest) {
    return this.users.matchesSummary(req.user.userId);
  }

  @Get('pending')
  pending(@Req() req: AuthedRequest) {
    return this.users.matchesByStatus(req.user.userId, 'pending');
  }

  @Get('accepted')
  accepted(@Req() req: AuthedRequest) {
    return this.users.matchesByStatus(req.user.userId, 'accepted');
  }

  @Get(':id/compatibility')
  compatibility(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.compatibilityWith(req.user.userId, id);
  }

  @Post(':id/accept')
  accept(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.acceptInterest(req.user.userId, id);
  }

  @Post(':id/reject')
  reject(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.rejectInterest(req.user.userId, id);
  }

  // Adapter endpoints for alternate client expectations (backwards-compatibility)
  @Post(':id/like')
  like(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.likeProfile(req.user.userId, { toUserId: id, type: 'like' });
  }

  @Post(':id/pass')
  pass(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.likeProfile(req.user.userId, { toUserId: id, type: 'pass' });
  }
}
