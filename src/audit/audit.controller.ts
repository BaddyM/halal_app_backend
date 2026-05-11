import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { AuditService } from './audit.service';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiQuery({ name: 'page' })
  @ApiQuery({ name: 'limit' })
  @ApiQuery({ name: 'entity', required: false })
  list_logs(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('entity') entity?: string,
  ) {
    return this.auditService.list(parseInt(page), parseInt(limit), entity);
  }

  @Post('period/lock')
  lock(
    @Body() body: { period: string; lockedById: string; note?: string },
  ) {
    return this.auditService.lock_period(
      body.period,
      body.lockedById,
      body.note,
    );
  }

  @Delete('period/lock/:id')
  unlock(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.auditService.unlock_period(id, body.userId);
  }

  @Get('period/locks')
  list_locks() {
    return this.auditService.list_period_locks();
  }

  @Get('period/:period/status')
  is_locked(@Param('period') period: string) {
    return this.auditService.is_locked(period);
  }
}
