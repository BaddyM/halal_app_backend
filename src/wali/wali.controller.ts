import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { WaliService } from './wali.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';

@Controller('wali')
export class WaliController {
  constructor(private readonly waliService: WaliService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Request() req: any) { return this.waliService.getMyWalis(req.user.id); }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMe(@Request() req: any, @Body() data: any) {
    return this.waliService.getMyWalis(req.user.id).then((links) => {
      const link = links[0];
      if (!link) throw new NotFoundException('No active Wali link');
      return this.waliService.updateWaliPermissions(req.user.id, link.linkId, data);
    });
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  removeMe(@Request() req: any) {
    return this.waliService.getMyWalis(req.user.id).then((links) => {
      const link = links[0];
      if (!link) throw new NotFoundException('No active Wali link');
      return this.waliService.revokeWali(req.user.id, link.linkId);
    });
  }

  @Post('resend-invite')
  @UseGuards(AuthGuard)
  resendInvite(@Request() req: any) {
    return this.waliService.resendInvite(req.user.id);
  }

  @Get('confirm')
  confirm(@Query('token') token: string) { return this.waliService.respondToToken(token, 'accept'); }

  @Get('accept')
  accept(@Query('token') token: string) { return this.waliService.respondToToken(token, 'accept'); }

  @Get('decline')
  decline(@Query('token') token: string) { return this.waliService.respondToToken(token, 'reject'); }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) { return this.waliService.unsubscribeByToken(token); }

  // ────────────────────────────────────────────────────────────────
  // WALI INVITATIONS & LINKS
  // ────────────────────────────────────────────────────────────────

  /**
   * Invite a Wali (Guardian)
   * POST /api/wali/invite
   */
  @Post('invite')
  @UseGuards(AuthGuard)
  async inviteWali(@Request() req: any, @Body() data: any) {
    return this.waliService.inviteWali(req.user.id, data);
  }

  /**
   * Accept/Reject Wali invitation
   * POST /api/wali/links/:linkId/respond
   */
  @Post('links/:linkId/respond')
  @UseGuards(AuthGuard)
  async respondToInvitation(
    @Request() req: any,
    @Param('linkId') linkId: string,
    @Body() data: any,
  ) {
    return this.waliService.respondToInvitation(req.user.id, linkId, data);
  }

  /**
   * Get my Walis (user's guardians)
   * GET /api/wali/my-walis
   */
  @Get('my-walis')
  @UseGuards(AuthGuard)
  async getMyWalis(@Request() req: any) {
    return this.waliService.getMyWalis(req.user.id);
  }

  /**
   * Get protected users (users I'm wali for)
   * GET /api/wali/protected-users
   */
  @Get('protected-users')
  @UseGuards(AuthGuard)
  async getProtectedUsers(@Request() req: any) {
    return this.waliService.getProtectedUsers(req.user.id);
  }

  /**
   * Revoke Wali access
   * POST /api/wali/links/:linkId/revoke
   */
  @HttpCode(200)
  @Post('links/:linkId/revoke')
  @UseGuards(AuthGuard)
  async revokeWali(@Request() req: any, @Param('linkId') linkId: string) {
    return this.waliService.revokeWali(req.user.id, linkId);
  }

  /**
   * Update Wali permissions
   * PATCH /api/wali/links/:linkId/permissions
   */
  @Patch('links/:linkId/permissions')
  @UseGuards(AuthGuard)
  async updatePermissions(
    @Request() req: any,
    @Param('linkId') linkId: string,
    @Body() data: any,
  ) {
    return this.waliService.updateWaliPermissions(req.user.id, linkId, data);
  }

  // ────────────────────────────────────────────────────────────────
  // APPROVAL WORKFLOW
  // ────────────────────────────────────────────────────────────────

  /**
   * Request Wali approval
   * POST /api/wali/request-approval
   */
  @Post('request-approval')
  @UseGuards(AuthGuard)
  async requestApproval(@Request() req: any, @Body() data: any) {
    return this.waliService.requestApproval(
      req.user.id,
      data.actionType,
      data.targetUserId,
      data.details,
    );
  }

  /**
   * Get pending approvals for Wali
   * GET /api/wali/pending-approvals
   */
  @Get('pending-approvals')
  @UseGuards(AuthGuard)
  async getPendingApprovals(@Request() req: any) {
    return this.waliService.getPendingApprovals(req.user.id);
  }

  /**
   * Approve/Reject approval request
   * POST /api/wali/approvals/:approvalId/respond
   */
  @HttpCode(200)
  @Post('approvals/:approvalId/respond')
  @UseGuards(AuthGuard)
  async respondToApproval(
    @Request() req: any,
    @Param('approvalId') approvalId: string,
    @Body() data: any,
  ) {
    return this.waliService.respondToApproval(req.user.id, approvalId, data.action);
  }

  // ────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get Wali statistics
   * GET /api/admin/wali/stats
   */
  @Get('admin/stats')
  @UseGuards(AuthGuard, AdminGuard)
  async getWaliStats() {
    return this.waliService.getWaliStats();
  }

  /**
   * Get user's Wali links
   * GET /api/admin/wali/users/:userId/links
   */
  @Get('admin/users/:userId/links')
  @UseGuards(AuthGuard, AdminGuard)
  async getUserWaliLinks(@Param('userId') userId: string) {
    return this.waliService.getUserWaliLinks(userId);
  }

  /**
   * Manage Wali link
   * PATCH /api/admin/wali/links/:linkId
   */
  @Patch('admin/links/:linkId')
  @UseGuards(AuthGuard, AdminGuard)
  async manageWaliLink(@Param('linkId') linkId: string, @Body() data: any) {
    return this.waliService.manageWaliLink(linkId, data.action);
  }
}
