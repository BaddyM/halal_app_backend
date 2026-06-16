import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AuditInterceptor } from './audit.interceptor';
import { AdminUsersService } from './admin-users.service';
import {
  AdminMessageDto,
  AdminUserQueryDto,
  CreateUserDto,
  SetUserStatusDto,
  VerifyUserDto,
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

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto) {
    return this.users.setStatus(id, dto.status as UserStatus);
  }

  @Patch(':id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyUserDto) {
    return this.users.setVerified(id, dto.verified);
  }

  @Post(':id/message')
  message(@Param('id') id: string, @Body() dto: AdminMessageDto) {
    return this.users.sendMessage(id, dto.subject, dto.body);
  }
}
