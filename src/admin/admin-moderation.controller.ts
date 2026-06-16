import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AuditInterceptor } from './audit.interceptor';
import { AdminModerationService } from './admin-moderation.service';
import { ResolveReportDto } from './dto';

@UseGuards(AuthGuard, AdminGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin/reports')
export class AdminModerationController {
  constructor(private readonly moderation: AdminModerationService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.moderation.listReports(status);
  }

  @Get('counts')
  counts() {
    return this.moderation.counts();
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.moderation.resolve(id, dto.status, dto.note);
  }

  @Post(':id/ban')
  ban(@Param('id') id: string) {
    return this.moderation.resolveAndBan(id);
  }
}
