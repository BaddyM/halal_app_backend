import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { VerificationService, VerificationType } from './verification.service';
import { UsersService } from 'src/users/users.service';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('verification')
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService, private readonly users: UsersService) {}

  @Get('status')
  status(@Req() req: AuthedRequest) { return this.verification.status(req.user.userId); }

  @Post('phone/submit')
  phone(@Req() req: AuthedRequest, @Body() body: { phone: string }) {
    return this.users.submitPhoneForVerification(req.user.userId, body.phone);
  }

  @Post('id/submit')
  identity(@Req() req: AuthedRequest, @Body() body: { submission: Record<string, unknown> }) {
    return this.users.submitIdentityVerification(req.user.userId, body.submission);
  }

  @Post('photo/submit')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req: any, _file, callback) => {
        const dir = `./uploads/verification/${req.user.userId}/photo`;
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        callback(null, dir);
      },
      filename: (_req, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    fileFilter: (_req, file, callback) => callback(imageTypes.includes(file.mimetype) ? null : new BadRequestException('Selfie must be JPG, PNG, or WEBP'), imageTypes.includes(file.mimetype)),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  submitPhoto(@Req() req: AuthedRequest, @UploadedFile() file: Express.Multer.File) {
    return this.verification.submitPhoto(req.user.userId, file);
  }
}

@Controller('admin/verification')
@UseGuards(AuthGuard, AdminGuard)
export class AdminVerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('queue')
  queue(@Query('type') type?: VerificationType, @Query('status') status = 'pending') {
    return this.verification.queue(type, status);
  }

  @Post(':id/approve')
  approve(@Req() req: AuthedRequest, @Param('id') userId: string, @Body() body: { type: VerificationType }) {
    return this.verification.review(userId, body.type, 'approve', undefined, req.user.userId, req.user.email);
  }

  @Post(':id/reject')
  reject(@Req() req: AuthedRequest, @Param('id') userId: string, @Body() body: { type: VerificationType; reason?: string }) {
    return this.verification.review(userId, body.type, 'reject', body.reason, req.user.userId, req.user.email);
  }

  @Get(':userId/photo')
  async photo(@Param('userId') userId: string, @Res() response: Response) {
    const file = await this.verification.photoDocumentPath(userId);
    return response.download(file.path, file.originalName);
  }
}

@Controller('admin/verifications')
@UseGuards(AuthGuard, AdminGuard)
export class DashboardVerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  queue(@Query('type') type?: string, @Query('status') status?: string, @Query('search') search?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.verification.dashboardQueue({ type, status, search, limit: Number(limit) || 50, offset: Number(offset) || 0 });
  }

  @Get(':userId')
  details(@Param('userId') userId: string) {
    return this.verification.adminDetails(userId);
  }

  @Get(':userId/audit')
  audit(@Param('userId') userId: string) {
    return this.verification.verificationAudit(userId);
  }

  @Patch(':userId')
  review(@Req() req: AuthedRequest, @Param('userId') userId: string, @Body() body: { type: string; status: string; reason?: string }) {
    const type = body.type === 'identity' ? 'id' : body.type as VerificationType;
    if (!['phone', 'photo', 'id'].includes(type)) throw new BadRequestException('Unknown verification type');
    const decision = body.status === 'verified' ? 'approve' : body.status === 'resubmissionRequired' ? 'resubmissionRequired' : 'reject';
    return this.verification.review(userId, type, decision, body.reason, req.user.userId, req.user.email);
  }
}
