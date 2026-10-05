import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { photoMulterOptions, publicPhotoUrl } from 'src/upload/photo-storage';
import { DeleteAccountDto, DiscoverQueryDto, SubmitOnboardingDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

/// Contract-compatible aliases used by the dashboard and newer app clients.
/// Business logic remains in UsersService so legacy `/users/*` routes behave
/// identically.
@Controller()
@UseGuards(AuthGuard)
export class UsersContractController {
  constructor(private readonly users: UsersService) {}

  @Get('profile')
  profile(@Req() req: AuthedRequest) {
    return this.users.getMe(req.user.userId);
  }

  @Put('profile')
  updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, dto);
  }

  @Post('profile/questionnaire')
  questionnaire(@Req() req: AuthedRequest, @Body() body: { answers: Record<string, unknown> }) {
    const answers = Object.entries(body.answers ?? {}).map(([questionId, answer]) => ({ questionId, answer }));
    return this.users.submitOnboarding(req.user.userId, { answers } as SubmitOnboardingDto);
  }

  @Get('profile/completeness')
  completeness(@Req() req: AuthedRequest) {
    return this.users.getCompleteness(req.user.userId);
  }

  @Post('profile/photos')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' }, files: { type: 'array', items: { type: 'string', format: 'binary' } }, isPrivate: { type: 'boolean' } } } })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'files', maxCount: 6 }], photoMulterOptions))
  addProfilePhotos(@Req() req: AuthedRequest, @UploadedFiles() uploaded: { image?: Express.Multer.File[]; files?: Express.Multer.File[] }, @Body('isPrivate') isPrivate?: string) {
    const files = [...(uploaded?.image ?? []), ...(uploaded?.files ?? [])];
    return this.users.addPhotos(req.user.userId, files.map((file) => ({ url: publicPhotoUrl(file.filename) })), {
      isPrivate: isPrivate === 'true' || isPrivate === '1',
    });
  }

  @Delete('profile/photos/:photoId')
  deleteProfilePhoto(@Req() req: AuthedRequest, @Param('photoId') photoId: string) {
    return this.users.deletePhoto(req.user.userId, photoId);
  }

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

  @Get('discover')
  discover(@Req() req: AuthedRequest, @Query() query: DiscoverQueryDto) {
    return this.users.discover(req.user.userId, query);
  }
}

@Controller('likes')
@UseGuards(AuthGuard)
export class LikesContractController {
  constructor(private readonly users: UsersService) {}

  @Post()
  like(@Req() req: AuthedRequest, @Body() body: { targetId: string }) {
    return this.users.likeProfile(req.user.userId, { toUserId: body.targetId, type: 'like' });
  }
}

@Controller('passes')
@UseGuards(AuthGuard)
export class PassesContractController {
  constructor(private readonly users: UsersService) {}

  @Post()
  pass(@Req() req: AuthedRequest, @Body() body: { targetId: string }) {
    return this.users.likeProfile(req.user.userId, { toUserId: body.targetId, type: 'pass' });
  }
}
