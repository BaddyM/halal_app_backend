import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminUsersService } from './admin-users.service';

/// Cross-user verification queue. Lives beside AdminUsersController rather
/// than inside it because the path is /admin/verifications, not
/// /admin/users/:id — a `:id` route there would swallow "verifications".
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/verifications')
export class AdminVerificationsController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('pending')
  pending(
    @Query('type') type?: 'phone' | 'identity',
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.users.listPendingVerifications({
      type,
      status,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
