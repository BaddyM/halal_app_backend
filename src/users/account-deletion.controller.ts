import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { RequestAccountDeletionDto } from './dto';
import { UsersService } from './users.service';

@Controller('account')
@UseGuards(AuthGuard)
export class AccountDeletionController {
  constructor(private readonly users: UsersService) {}

  @Delete()
  request(@Req() req: AuthedRequest, @Body() dto: RequestAccountDeletionDto) {
    return this.users.requestAccountDeletion(req.user.userId, dto);
  }
}

@Controller('admin/account-deletion-requests')
@UseGuards(AuthGuard, AdminGuard)
export class AdminAccountDeletionController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.users.listAccountDeletionRequests(status ?? 'pending');
  }

  @Post(':id/approve')
  approve(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.reviewAccountDeletionRequest(id, req.user.userId, true);
  }

  @Post(':id/reject')
  reject(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.reviewAccountDeletionRequest(id, req.user.userId, false);
  }
}
