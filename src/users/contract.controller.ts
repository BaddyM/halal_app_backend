import { Body, Controller, Delete, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { DeleteAccountDto, DiscoverQueryDto, SubmitOnboardingDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

/// Contract-compatible aliases used by the dashboard and newer app clients.
/// Business logic remains in UsersService so legacy `/users/*` routes behave
/// identically.
@Controller()
@UseGuards(AuthGuard)
export class UsersContractController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.users.getMe(req.user.userId);
  }

  @Patch('me')
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, dto);
  }

  @Delete('me')
  deleteMe(@Req() req: AuthedRequest, @Body() dto: DeleteAccountDto) {
    return this.users.deleteAccount(req.user.userId, dto);
  }

  @Get('onboarding/status')
  onboardingStatus(@Req() req: AuthedRequest) {
    return this.users.getMe(req.user.userId).then((profile: any) => ({
      completed: (profile.completeness ?? 0) >= 100,
      completeness: profile.completeness ?? 0,
      profile,
    }));
  }

  @Post('onboarding/submit')
  submitOnboarding(@Req() req: AuthedRequest, @Body() dto: SubmitOnboardingDto) {
    return this.users.submitOnboarding(req.user.userId, dto);
  }

  @Get('discovery')
  discovery(@Req() req: AuthedRequest, @Query() query: DiscoverQueryDto) {
    return this.users.discover(req.user.userId, query);
  }
}
