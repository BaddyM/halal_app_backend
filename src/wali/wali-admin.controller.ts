import {
  Controller,
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

  @Post(':id/status')
  status(@Param('id') id: string, @Body() data: any) {
    return this.waliService.updateAdminStatus(id, data.status);
  }

  @Post(':id/resend-invite')
  resend(@Param('id') id: string) {
    return this.waliService.manageWaliLink(id, 'resend');
  }

  @Post(':id/send-digest')
  sendDigest(@Param('id') id: string) {
    return { waliId: id, sent: false, reason: 'No undelivered digest items' };
  }

  @Get(':id/digest-preview')
  async digestPreview(@Param('id') id: string) {
    return { waliId: id, period: 'weekly', newMatches: 0, newLikes: 0, newMessages: 0, usersLinked: 0 };
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
  async getApprovals(@Query('status') status: string = 'pending') {
    // TODO: Implement admin approval viewing
    return [];
  }

  /**
   * Send manual digest
   * POST /api/admin/wali/send-digest
   */
  @Post('send-digest')
  async sendDigestAll(@Body() data: any) {
    // TODO: Implement manual digest sending
    return { sent: true };
  }
}
