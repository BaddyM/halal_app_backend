import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WaliService } from './wali.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';

@Controller('admin/wali')
@UseGuards(AuthGuard, AdminGuard)
export class AdminWaliController {
  constructor(private waliService: WaliService) {}

  @Get()
  async list(@Query('status') status?: string, @Query('search') search?: string) {
    return { data: await this.waliService.listAllWali(status, search), meta: { status: status ?? null, search: search ?? null } };
  }

  @Get('settings')
  settings() { return this.waliService.getAdminSettings(); }

  @Patch('settings')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.waliService.updateAdminSettings(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.waliService.updateAdminStatus(id, data.status ?? data.action);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.waliService.deleteAdminLink(id);
  }

  @Post(':id/status')
  status(@Param('id') id: string, @Body() data: any) {
    return this.waliService.updateAdminStatus(id, data.status);
  }

  @Post(':id/resend-invite')
  resend(@Param('id') id: string) {
    return this.waliService.manageWaliLink(id, 'resend');
  }

  @Post(':id/send-digest')
  sendDigest(@Param('id') id: string, @Query('days') days?: string) {
    return this.waliService.sendDigest(id, days ? Number(days) : 7);
  }

  @Get(':id/digest-preview')
  digestPreview(@Param('id') id: string, @Query('days') days?: string) {
    return this.waliService.digestPreview(id, days ? Number(days) : 7);
  }

  /**
   * Get Wali statistics
   * GET /api/admin/wali/stats
   */
  @Get('stats')
  async getStats() {
    return this.waliService.getWaliStats();
  }

  /**
   * Get user's Wali links
   * GET /api/admin/wali/users/:userId/links
   */
  @Get('users/:userId/links')
  async getUserLinks(@Param('userId') userId: string) {
    return this.waliService.getUserWaliLinks(userId);
  }

  /**
   * Manage Wali link
   * PATCH /api/admin/wali/links/:linkId
   */
  @Patch('links/:linkId')
  async manageLink(@Param('linkId') linkId: string, @Body() data: any) {
    return this.waliService.manageWaliLink(linkId, data.action);
  }

  /**
   * View Wali approval requests
   * GET /api/admin/wali/approvals?status=pending
   */
  @Get('approvals')
  getApprovals(@Query('status') status: string = 'pending') {
    return this.waliService.listApprovals(status);
  }

  /**
   * Send manual digest
   * POST /api/admin/wali/send-digest
   */
  @Post('send-digest')
  sendDigestAll(@Body() data: any) {
    return this.waliService.sendDigestToAll(data?.days ? Number(data.days) : 7);
  }
}
