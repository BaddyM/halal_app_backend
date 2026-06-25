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
  AttachSubscriptionDto,
  CreateAdDto,
  CreatePlanDto,
  UpdateAdDto,
  UpdateIslamicSettingsDto,
  UpdatePlanDto,
  UpdateSubscriptionDto,
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

  // ── Plans (subscription packages) ──────────────────────────
  @Get('plans')
  listPlans() {
    return this.catalog.listPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.catalog.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.catalog.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.catalog.deletePlan(id);
  }

  // ── Subscriptions ──────────────────────────────────────────
  @Get('subscriptions')
  listSubscriptions() {
    return this.catalog.listSubscriptions();
  }

  @Post('subscriptions')
  attachSubscription(@Body() dto: AttachSubscriptionDto) {
    return this.catalog.attachSubscription(dto);
  }

  @Patch('subscriptions/:id')
  updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.catalog.updateSubscription(id, dto);
  }

  @Delete('subscriptions/:id')
  deleteSubscription(@Param('id') id: string) {
    return this.catalog.deleteSubscription(id);
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
