import {
  Body,
  ConflictException,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { UpdateMeDto } from './dto';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  /// Identity/health check for the dashboard — confirms the caller is an admin.
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  }

  /// Update the signed-in admin's own profile (name / email / password).
  @Patch('me')
  async updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateMeDto) {
    const data: { name?: string; email?: string; password?: string } = {};
    if (dto.name) data.name = dto.name;
    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: req.user.userId } },
        select: { id: true },
      });
      if (clash) throw new ConflictException('Email already in use');
      data.email = dto.email;
    }
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  }
}
