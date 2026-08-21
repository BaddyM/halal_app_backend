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
import { AdminGuard } from 'src/admin/admin.guard';

@Controller('api/admin/wali')
@UseGuards(AdminGuard)
export class AdminWaliController {
  constructor(private waliService: WaliService) {}

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
  async sendDigest(@Body() data: any) {
    // TODO: Implement manual digest sending
    return { sent: true };
  }
}
