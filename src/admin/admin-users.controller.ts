import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserStatus } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AuditInterceptor } from './audit.interceptor';
import { AdminUsersService } from './admin-users.service';
import {
  AdminMessageDto,
  AdminUpdateUserDto,
  AdminUserQueryDto,
  CreateUserDto,
  SetUserStatusDto,
  VerifyUserDto,
  VerificationReviewDto,
} from './dto';

@UseGuards(AuthGuard, AdminGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() q: AdminUserQueryDto) {
    return this.users.list(q);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.createUser(dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.users.getOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.updateUser(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto) {
    return this.users.setStatus(id, dto.status as UserStatus);
  }

  @Patch(':id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyUserDto) {
    return this.users.setVerified(id, dto.verified);
  }

  @Get(':id/verification')
  verification(@Param('id') id: string) {
    return this.users.getVerification(id);
  }

  @Patch(':id/verification/phone')
  reviewPhone(@Param('id') id: string, @Body() dto: VerificationReviewDto) {
    return this.users.reviewPhoneVerification(id, dto.status, dto.reason);
  }

  @Patch(':id/verification/identity')
  reviewIdentity(@Param('id') id: string, @Body() dto: VerificationReviewDto) {
    return this.users.reviewIdentityVerification(id, dto.status, dto.reason);
  }

  @Post(':id/message')
  message(@Param('id') id: string, @Body() dto: AdminMessageDto) {
    return this.users.sendMessage(id, dto.subject, dto.body);
  }

  @Post(':id/reset-swipes')
  resetSwipes(@Param('id') id: string) {
    return this.users.resetSwipes(id);
  }

  @Get(':id/verification/documents/:documentId')
  async verificationDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const document = await this.users.getVerificationDocumentPath(id, documentId);
    return res.download(document.path, document.originalName);
  }
}
