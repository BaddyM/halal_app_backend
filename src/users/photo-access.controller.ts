import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from './users.service';

@Controller('photos')
@UseGuards(AuthGuard)
export class PhotoAccessController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  getPhoto(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.users.photoUrlForViewer(req.user.userId, id);
  }
}

@Controller('photos/private')
@UseGuards(AuthGuard)
export class PrivatePhotoAccessController {
  constructor(private readonly users: UsersService) {}

  @Post('requests')
  request(@Req() req: AuthedRequest, @Body() body: { ownerId: string; reason?: string }) {
    return this.users.requestPhotoAccess(req.user.userId, body.ownerId, body.reason);
  }

  @Get('requests/received')
  received(@Req() req: AuthedRequest) {
    return this.users.listPhotoRequests(req.user.userId);
  }

  @Post('requests/:id/approve')
  approve(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.respondPhotoRequestById(req.user.userId, id, true);
  }

  @Post('requests/:id/decline')
  decline(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.respondPhotoRequestById(req.user.userId, id, false);
  }

  @Get('grants')
  grants(@Req() req: AuthedRequest) {
    return this.users.listPhotoGrants(req.user.userId);
  }

  @Delete('grants/:userId')
  revoke(@Req() req: AuthedRequest, @Param('userId') userId: string) {
    return this.users.revokePhotoGrant(req.user.userId, userId);
  }
}

@Controller('media/private-photos')
export class PrivatePhotoMediaController {
  constructor(private readonly users: UsersService) {}

  @Get(':photoId')
  async getFile(@Param('photoId') photoId: string, @Query('token') token: string, @Res() response: Response) {
    const media = await this.users.getPrivatePhotoFile(photoId, token ?? '');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', media.contentType);
    return response.sendFile(media.filePath);
  }
}

@Controller('admin/photos/private-requests')
@UseGuards(AuthGuard, AdminGuard)
export class AdminPhotoAccessController {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService) {}

  @Get()
  listAudit() {
    return this.prisma.photoAccessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  }

  @Post(':ownerId/:userId/revoke')
  revoke(@Param('ownerId') ownerId: string, @Param('userId') userId: string) {
    return this.users.revokePhotoGrant(ownerId, userId);
  }
}

@Controller('admin/photos')
@UseGuards(AuthGuard, AdminGuard)
export class AdminPhotoModerationController {
  constructor(private readonly users: UsersService) {}

  @Get()
  queue(@Query('status') status = 'pending', @Query('search') search?: string) {
    return this.users.adminPhotoQueue(status, search);
  }

  @Patch(':id')
  review(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { status: 'approved' | 'rejected'; reason?: string }) {
    return this.users.reviewPhotoModeration(id, body.status, body.reason, req.user.userId, req.user.email);
  }
}

@Controller('admin/photo-requests')
@UseGuards(AuthGuard, AdminGuard)
export class AdminPhotoRequestsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.adminPhotoRequests();
  }

  @Patch(':id')
  revoke(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { status?: string; reason?: string }) {
    if (body.status !== 'revoked') throw new BadRequestException('Only safety revocation is supported');
    return this.users.adminRevokePhotoRequest(id, req.user.userId, body.reason);
  }
}
