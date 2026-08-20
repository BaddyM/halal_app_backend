import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuthGuard } from 'src/auth/auth.guard';
import { ReplySupportTicketDto, UpdateSupportTicketDto } from './dto';
import { SupportService } from './support.service';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/support/tickets')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Query('status') status?: string) { return this.support.listForAdmin(status); }

  @Get(':id')
  get(@Param('id') id: string) { return this.support.getAdmin(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupportTicketDto) {
    return this.support.updateForAdmin(id, dto);
  }

  @Post(':id/replies')
  reply(@Param('id') id: string, @Body() dto: ReplySupportTicketDto) {
    return this.support.replyForAdmin(id, dto);
  }
}
