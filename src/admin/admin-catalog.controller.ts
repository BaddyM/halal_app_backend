import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AuditInterceptor } from './audit.interceptor';
import { AdminCatalogService } from './admin-catalog.service';
import {
  CreateAdDto,
  UpdateAdDto,
  UpdateIslamicSettingsDto,
  UpdatePlanDto,
} from './dto';

@UseGuards(AuthGuard, AdminGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  // ── Ads ────────────────────────────────────────────────────
  @Get('ads')
  listAds() {
    return this.catalog.listAds();
  }

  @Post('ads')
  createAd(@Body() dto: CreateAdDto) {
    return this.catalog.createAd(dto);
  }

  @Patch('ads/:id')
  updateAd(@Param('id') id: string, @Body() dto: UpdateAdDto) {
    return this.catalog.updateAd(id, dto);
  }

  @Delete('ads/:id')
  deleteAd(@Param('id') id: string) {
    return this.catalog.deleteAd(id);
  }

  // ── Plans ──────────────────────────────────────────────────
  @Get('plans')
  listPlans() {
    return this.catalog.listPlans();
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.catalog.updatePlan(id, dto);
  }

  // ── Islamic settings ───────────────────────────────────────
  @Get('islamic/settings')
  islamicSettings() {
    return this.catalog.getIslamicSettings();
  }

  @Patch('islamic/settings')
  updateIslamic(@Body() dto: UpdateIslamicSettingsDto) {
    return this.catalog.updateIslamicSettings(dto);
  }
}
