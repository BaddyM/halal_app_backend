import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { photoMulterOptions, publicPhotoUrl } from 'src/upload/photo-storage';
import {
    ChangePlanDto,
    DiscoverQueryDto,
    LikeProfileDto,
    ReportUserDto,
    SetWaliDto,
    SubmitOnboardingDto,
    UpdatePhotoDto,
    UpdateProfileDto,
} from './dto';

@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) {}

    @Get('me')
    me(@Req() req: AuthedRequest) {
        return this.users.getMe(req.user.userId);
    }

    @Patch('me/profile')
    updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
        return this.users.updateProfile(req.user.userId, dto);
    }

    @Post('me/onboarding')
    submitOnboarding(@Req() req: AuthedRequest, @Body() dto: SubmitOnboardingDto) {
        return this.users.submitOnboarding(req.user.userId, dto);
    }

    @Patch('me/plan')
    changePlan(@Req() req: AuthedRequest, @Body() dto: ChangePlanDto) {
        return this.users.changePlan(req.user.userId, dto.plan);
    }

    // ── Wali / guardian ──────────────────────────────────────────
    @Post('me/wali')
    setWali(@Req() req: AuthedRequest, @Body() dto: SetWaliDto) {
        return this.users.setWali(req.user.userId, dto);
    }

    // ── Completeness ─────────────────────────────────────────────
    @Get('me/completeness')
    completeness(@Req() req: AuthedRequest) {
        return this.users.getCompleteness(req.user.userId);
    }

    // ── Photos (gallery) ─────────────────────────────────────────
    @Get('me/photos')
    listPhotos(@Req() req: AuthedRequest) {
        return this.users.listMyPhotos(req.user.userId);
    }

    @Post('me/photos')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                files: { type: 'array', items: { type: 'string', format: 'binary' } },
                isPrivate: { type: 'boolean' },
            },
        },
    })
    @UseInterceptors(FilesInterceptor('files', 6, photoMulterOptions))
    addPhotos(
        @Req() req: AuthedRequest,
        @UploadedFiles() files: Express.Multer.File[],
        @Body('isPrivate') isPrivate?: string,
    ) {
        const urls = (files ?? []).map((f) => ({ url: publicPhotoUrl(f.filename) }));
        return this.users.addPhotos(req.user.userId, urls, {
            isPrivate: isPrivate === 'true' || isPrivate === '1',
        });
    }

    @Patch('me/photos/:photoId')
    updatePhoto(
        @Req() req: AuthedRequest,
        @Param('photoId') photoId: string,
        @Body() dto: UpdatePhotoDto,
    ) {
        return this.users.updatePhoto(req.user.userId, photoId, dto);
    }

    @Delete('me/photos/:photoId')
    deletePhoto(@Req() req: AuthedRequest, @Param('photoId') photoId: string) {
        return this.users.deletePhoto(req.user.userId, photoId);
    }

    // Pending inbound private-photo requests addressed to me.
    @Get('me/photo-requests')
    photoRequests(@Req() req: AuthedRequest) {
        return this.users.listPhotoRequests(req.user.userId);
    }

    @Get('discover')
    discover(@Req() req: AuthedRequest, @Query() q: DiscoverQueryDto) {
        return this.users.discover(req.user.userId, q);
    }

    @Get('matches')
    matches(@Req() req: AuthedRequest, @Query('status') status?: string) {
        return this.users.matchesByStatus(req.user.userId, status);
    }

    // ── Safety ───────────────────────────────────────────────────
    // Declared before the `:id` catch-all so 'me' isn't swallowed as an id.
    @Get('me/blocked')
    listBlocked(@Req() req: AuthedRequest) {
        return this.users.listBlocked(req.user.userId);
    }

    @Post(':id/block')
    block(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.users.blockUser(req.user.userId, id);
    }

    @Delete(':id/block')
    unblock(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.users.unblockUser(req.user.userId, id);
    }

    @Post(':id/report')
    report(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() dto: ReportUserDto,
    ) {
        return this.users.reportUser(req.user.userId, id, dto.reason, dto.details);
    }

    // ── Private-photo access ─────────────────────────────────────
    // Ask `:id` to unlock their private photos for me.
    @Post(':id/photo-request')
    requestPhotos(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.users.requestPhotoAccess(req.user.userId, id);
    }

    // Grant a previously-received request from `:id` (the requester).
    @Post(':id/photo-grant')
    grantPhotos(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.users.respondPhotoAccess(req.user.userId, id, true);
    }

    @Post(':id/photo-deny')
    denyPhotos(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.users.respondPhotoAccess(req.user.userId, id, false);
    }

    @Get('likes/incoming')
    incomingLikes(@Req() req: AuthedRequest) {
        return this.users.listIncomingLikes(req.user.userId);
    }

    @Post('like')
    like(@Req() req: AuthedRequest, @Body() dto: LikeProfileDto) {
        return this.users.likeProfile(req.user.userId, dto);
    }

    @Get(':id')
    getById(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.users.getProfileById(req.user.userId, id);
    }
}
