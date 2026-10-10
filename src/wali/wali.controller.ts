import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  Header,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { WaliService } from './wali.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';

@Controller('wali')
export class WaliController {
  constructor(private readonly waliService: WaliService) {}

  @Get()
  @UseGuards(AuthGuard)
  listAliases(@Request() req: any) {
    return this.waliService.getMyWalis(req.user.id);
  }

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

  @Get('status')
  @UseGuards(AuthGuard)
  status(@Request() req: any) {
    return this.waliService.getStatus(req.user.id);
  }

  @Delete()
  @UseGuards(AuthGuard)
  remove(@Request() req: any) {
    return this.waliService.removeForUser(req.user.id);
  }

  @Post('resend-invite')
  @UseGuards(AuthGuard)
  resendInvite(@Request() req: any) {
    return this.waliService.resendInvite(req.user.id);
  }

  @Get('share-invitation')
  @UseGuards(AuthGuard)
  shareInvitation(@Request() req: any) {
    return this.waliService.getShareableInvitation(req.user.id);
  }

  @Get('confirm')
  confirm(@Query('token') token: string) { return this.waliService.respondToToken(token, 'accept'); }

  @Get('accept')
  accept(@Query('token') token: string) { return this.waliService.respondToToken(token, 'accept'); }

  @Get('decline')
  decline(@Query('token') token: string) { return this.waliService.respondToToken(token, 'reject'); }

  @Get('confirm/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  confirmSigned(
    @Param('token') token: string,
    @Query('decline') declineToken?: string,
  ) {
    return this.invitationPage(token, declineToken);
  }

  @Get('decline/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  declineSigned(@Param('token') token: string) {
    return this.invitationPage(undefined, token);
  }

  @Post('respond-token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async respondToToken(@Body() body: { token?: string; action?: string }) {
    if (
      typeof body?.token !== 'string' ||
      (body.action !== 'accept' && body.action !== 'reject')
    ) {
      throw new NotFoundException('Invitation link is invalid or expired.');
    }
    await this.waliService.respondToToken(body.token, body.action);
    const accepted = body.action === 'accept';
    return this.invitationResultPage(
      accepted ? 'Invitation accepted' : 'Invitation declined',
      accepted
        ? 'You will receive email summaries when the member has enabled them. No app or account is needed.'
        : 'You will not receive Wali summaries for this invitation.',
    );
  }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) { return this.waliService.unsubscribeByToken(token); }

  // ────────────────────────────────────────────────────────────────
  // WALI INVITATIONS & LINKS
  // ────────────────────────────────────────────────────────────────

  /**
   * Invite a Wali (Guardian)
   * POST /api/wali/invite
   */
  @Patch('preferences')
  @UseGuards(AuthGuard)
  async updatePreferences(
    @Request() req: any,
    @Body() data: { ccChats?: boolean; weeklySummary?: boolean; matchApprovals?: boolean },
  ) {
    const links = await this.waliService.getMyWalis(req.user.id);
    const link = links[0];
    if (!link) throw new NotFoundException('No active Wali link');
    return this.waliService.updateWaliPermissions(req.user.id, link.linkId, {
      ...(data.ccChats !== undefined && { seeChats: !!data.ccChats }),
      ...(data.matchApprovals !== undefined && { approveMatches: !!data.matchApprovals }),
    });
  }

  @Put('preferences')
  @UseGuards(AuthGuard)
  async updateDeliveryPreferences(
    @Request() req: any,
    @Body() data: {
      waliEnabled?: boolean;
      chatSummaries?: boolean;
      weeklyDigest?: boolean;
      matchAlerts?: boolean;
    },
  ) {
    return this.waliService.updateDeliveryPreferences(req.user.id, {
      ...(data.waliEnabled !== undefined && { waliEnabled: data.waliEnabled }),
      ...(data.chatSummaries !== undefined && { chatSummaries: data.chatSummaries }),
      ...(data.weeklyDigest !== undefined && { weeklyDigest: data.weeklyDigest }),
      ...(data.matchAlerts !== undefined && { matchAlerts: data.matchAlerts }),
    });
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteAlias(@Request() req: any, @Param('id') id: string) {
    return this.waliService.revokeWali(req.user.id, id);
  }

  @Post('invite')
  @UseGuards(AuthGuard)
  async inviteWali(@Request() req: any, @Body() data: any) {
    const payload = {
      ...data,
      waliName: data?.name ?? data?.waliName,
      waliEmail: data?.email ?? data?.waliEmail,
      relationship: data?.relationship,
      message: data?.message,
    };
    return this.waliService.inviteWali(req.user.id, payload);
  }

  private invitationPage(acceptToken?: string, declineToken?: string) {
    const escapeAttribute = (token: string) =>
      token.replace(
        /[&<>"']/g,
        (character) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[character] ?? character,
      );
    const action = '/api/wali/respond-token';
    const acceptForm = acceptToken
      ? `<form method="post" action="${action}" style="margin:24px 0 12px;">
              <input type="hidden" name="token" value="${escapeAttribute(acceptToken)}">
              <input type="hidden" name="action" value="accept">
              <button type="submit" style="width:100%;padding:14px;border:0;border-radius:10px;background:#8047e1;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">Accept and receive enabled email summaries</button>
            </form>`
      : '';
    const declineForm = declineToken
      ? `<form method="post" action="${action}">
              <input type="hidden" name="token" value="${escapeAttribute(declineToken)}">
              <input type="hidden" name="action" value="reject">
              <button type="submit" style="width:100%;padding:12px;border:1px solid #e5e3ee;border-radius:10px;background:#fff;color:#67677a;font-size:14px;cursor:pointer;">Decline invitation</button>
            </form>`
      : '';
    return `<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wali invitation — Halal Connect</title></head>
      <body style="margin:0;padding:28px 14px;background:#fcfbff;font-family:Arial,Helvetica,sans-serif;color:#1c172b;">
        <main style="max-width:520px;margin:8vh auto;background:#fff;border:1px solid #e5e3ee;border-radius:16px;overflow:hidden;">
          <header style="padding:22px 28px;background:#8047e1;border-bottom:3px solid #bf83fe;color:#fff;font-size:19px;font-weight:700;">Halal Connect</header>
          <section style="padding:28px;">
            <h1 style="margin:0 0 14px;color:#622cb5;font-size:24px;">Wali invitation</h1>
            <p style="color:#67677a;font-size:15px;line-height:1.7;">Accepting confirms that you agree to receive email summaries when the member has enabled them. The member controls whether chat content is shared. You do not need an app or account.</p>
            ${acceptForm}
            ${declineForm}
            <p style="margin:20px 0 0;color:#8a8794;font-size:12px;line-height:1.6;">Opening this page does not accept or decline the invitation. It expires automatically.</p>
          </section>
        </main>
      </body></html>`;
  }

  private invitationResultPage(title: string, message: string) {
    return `<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Halal Connect</title></head>
      <body style="margin:0;padding:28px 14px;background:#fcfbff;font-family:Arial,Helvetica,sans-serif;color:#1c172b;">
        <main style="max-width:520px;margin:8vh auto;background:#fff;border:1px solid #e5e3ee;border-radius:16px;overflow:hidden;">
          <header style="padding:22px 28px;background:#8047e1;border-bottom:3px solid #bf83fe;color:#fff;font-size:19px;font-weight:700;">Halal Connect</header>
          <section style="padding:28px;"><h1 style="margin:0 0 14px;color:#622cb5;font-size:24px;">${title}</h1><p style="color:#67677a;font-size:15px;line-height:1.7;">${message}</p></section>
        </main>
      </body></html>`;
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
    return this.waliService.respondToApproval(
      req.user.id,
      approvalId,
      data.action,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get Wali statistics
   * GET /api/admin/wali/stats
   */
  @Get('/admin/stats')
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
