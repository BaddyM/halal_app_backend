import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AccountDeletionService } from './account-deletion.service';
import { ConfirmDeletionDto, RejectDeletionDto } from './dto';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/deletion-requests')
export class AdminAccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.deletion.listForAdmin(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.deletion.getForAdmin(id);
  }

  @Post(':id/confirm')
  confirm(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ConfirmDeletionDto,
  ) {
    return this.deletion.confirm(id, req.user.userId, dto);
  }

  @Post(':id/reject')
  reject(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: RejectDeletionDto,
  ) {
    return this.deletion.reject(id, req.user.userId, dto);
  }
}
