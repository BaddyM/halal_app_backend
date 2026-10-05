import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

// ────────────────────────────────────────────────────────────────
// INTERFACES
// ────────────────────────────────────────────────────────────────

export interface WaliInviteRequest {
  waliName?: string;
  waliEmail: string;
  waliPhone?: string;
  relationship?: string;
  message?: string;
}

export interface WaliRespondRequest {
  action: 'accept' | 'reject';
  permissions?: {
    seeProfiles: boolean;
    seeChats: boolean;
    approveLikes: boolean;
    approveMatches: boolean;
  };
}

export interface WaliPermissionsUpdate {
  seeProfiles?: boolean;
  seeChats?: boolean;
  approveLikes?: boolean;
  approveMatches?: boolean;
}

// ────────────────────────────────────────────────────────────────
// WALI SERVICE
// ────────────────────────────────────────────────────────────────

@Injectable()
export class WaliService {
  private readonly logger = new Logger(WaliService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeBus,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  private signInvitation(linkId: string, action: 'accept' | 'reject') {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ linkId, action, expiresAt })).toString('base64url');
    const secret = this.config.get<string>('WALI_LINK_SECRET') ?? this.config.get<string>('SYSTEM_SECRET') ?? 'dev-secret';
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyInvitation(token: string, action: 'accept' | 'reject') {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new BadRequestException('Invalid invitation link');
    const secret = this.config.get<string>('WALI_LINK_SECRET') ?? this.config.get<string>('SYSTEM_SECRET') ?? 'dev-secret';
    const expected = createHmac('sha256', secret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new BadRequestException('Invalid invitation link');
    }
    let claims: { linkId: string; action: string; expiresAt: number };
    try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
    catch { throw new BadRequestException('Invalid invitation link'); }
    if (claims.action !== action || claims.expiresAt <= Date.now()) {
      throw new BadRequestException('Invitation link has expired or is invalid');
    }
    return claims.linkId;
  }

  // ────────────────────────────────────────────────────────────────
  // WALI INVITE & ACCEPTANCE
  // ────────────────────────────────────────────────────────────────

  /**
   * Invite a Wali (Guardian)
   */
  async inviteWali(userId: string, data: WaliInviteRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!data.waliEmail)
      throw new BadRequestException('Wali email is required');

    const previousProfile = user.profile;
    const changedFields = [
      previousProfile?.waliName !== data.waliName ? 'name' : null,
      previousProfile?.waliEmail?.toLowerCase() !== data.waliEmail.toLowerCase()
        ? 'email address'
        : null,
      (previousProfile?.waliPhone ?? '') !== (data.waliPhone ?? '')
        ? 'phone number'
        : null,
      (previousProfile?.waliRelation ?? '') !== (data.relationship ?? '')
        ? 'relationship'
        : null,
    ].filter((field): field is string => field !== null);
    const hadWaliDetails =
      !!previousProfile?.waliName ||
      !!previousProfile?.waliEmail ||
      !!previousProfile?.waliPhone;

    await this.prisma.profile.upsert({
      where: { userId },
      update: {
        waliName: data.waliName ?? null,
        waliEmail: data.waliEmail,
        waliPhone: data.waliPhone ?? null,
        waliRelation: data.relationship ?? null,
      },
      create: {
        userId,
        waliName: data.waliName ?? null,
        waliEmail: data.waliEmail,
        waliPhone: data.waliPhone ?? null,
        waliRelation: data.relationship ?? null,
      },
    });

    // Walis act through email links. Reuse an existing account or create an
    // email-only guardian identity for the invitation flow.
    const wali = await this.prisma.user.findUnique({
      where: { email: data.waliEmail },
    });
    const waliAccount =
      wali ??
      (await this.prisma.user.create({
        data: {
          email: data.waliEmail,
          name: data.waliName ?? 'Wali',
          password: `wali-${Math.random().toString(36).slice(2)}`,
          isActive: true,
          isEmailVerified: true,
        },
      }));

    // Check for existing link
    const existing = await this.prisma.waliLink.findUnique({
      where: {
        waliId_userId: {
          waliId: waliAccount.id,
          userId: user.id,
        },
      },
    });

    if (
      existing &&
      existing.status !== 'rejected' &&
      changedFields.length === 0
    ) {
      return {
        linkId: existing.id,
        waliEmail: data.waliEmail,
        status: existing.status,
        inviteSentAt: existing.inviteSentAt,
      };
    }

    // Create/update link
    const link = await this.prisma.waliLink.upsert({
      where: {
        waliId_userId: {
          waliId: waliAccount.id,
          userId: user.id,
        },
      },
      create: {
        waliId: waliAccount.id,
        userId: user.id,
        status: 'pending',
        inviteSentAt: new Date(),
      },
      update: {
        status:
          existing?.status === 'rejected'
            ? 'pending'
            : (existing?.status ?? 'pending'),
        inviteSentAt: new Date(),
      },
    });

    if (hadWaliDetails && changedFields.length > 0) {
      await this.mail.sendWaliChangeNotification({
        to: data.waliEmail,
        waliName: data.waliName ?? waliAccount.name,
        userName: user.name,
        changedFields,
      });
    } else {
      // Send the invitation through the shared mail transport. Acceptance happens
      // through this token link; no app login is required on the guardian side.
      await this.mail.sendWaliInvitation({
        to: waliAccount.email,
        waliName: waliAccount.name,
        userName: user.name,
        message: data.message,
        invitationToken: this.signInvitation(link.id, 'accept'),
        declineToken: this.signInvitation(link.id, 'reject'),
      });
    }

    // Emit event
    this.realtime.emitToUser(waliAccount.id, 'wali:invitation-received', {
      linkId: link.id,
      userName: user.name,
      message: data.message,
    });

    return {
      linkId: link.id,
      waliEmail: data.waliEmail,
      status: 'pending',
      inviteSentAt: link.inviteSentAt,
    };
  }

  async resendInvite(userId: string) {
    const link = await this.prisma.waliLink.findFirst({
      where: { userId, status: 'pending' },
      orderBy: { updatedAt: 'desc' },
      include: { user: true, wali: true },
    });
    if (!link) throw new NotFoundException('No pending Wali invitation');
    await this.mail.sendWaliInvitation({
      to: link.wali.email,
      waliName: link.wali.name,
      userName: link.user.name,
      invitationToken: this.signInvitation(link.id, 'accept'),
      declineToken: this.signInvitation(link.id, 'reject'),
    });
    return this.prisma.waliLink.update({
      where: { id: link.id },
      data: { inviteSentAt: new Date() },
    });
  }

  /**
   * Accept/Reject Wali invitation
   */
  async respondToInvitation(
    waliId: string,
    linkId: string,
    data: WaliRespondRequest,
  ) {
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
    });

    if (!link) throw new NotFoundException('Link not found');
    if (link.waliId !== waliId)
      throw new ForbiddenException('Not your invitation');
    if (link.status !== 'pending')
      throw new BadRequestException('Link already responded to');

    const updatedLink = await this.prisma.waliLink.update({
      where: { id: linkId },
      data: {
        status: data.action === 'accept' ? 'active' : 'rejected',
        acceptedAt: data.action === 'accept' ? new Date() : undefined,
        rejectedAt: data.action === 'reject' ? new Date() : undefined,
        ...data.permissions,
      },
    });

    // Emit events
    if (data.action === 'accept') {
      this.realtime.emitToUser(link.userId, 'wali:link-activated', {
        linkId,
        waliId,
      });
    }

    return {
      linkId,
      status: updatedLink.status,
      permissions: data.action === 'accept' ? data.permissions : undefined,
      acceptedAt: updatedLink.acceptedAt,
    };
  }

  async respondToToken(token: string, action: 'accept' | 'reject') {
    const linkId = this.verifyInvitation(token, action);
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
    });
    if (!link) throw new NotFoundException('Invitation not found');
    return this.respondToInvitation(link.waliId, link.id, { action });
  }

  async unsubscribeByToken(token: string) {
    const link = await this.prisma.waliLink.findUnique({
      where: { id: token },
    });
    if (!link) throw new NotFoundException('Wali link not found');
    return this.prisma.waliLink.update({
      where: { id: link.id },
      data: { status: 'revoked', revokedAt: new Date() },
    });
  }

  /**
   * Get my Walis (user's guardians)
   */
  async getMyWalis(userId: string) {
    const links = await this.prisma.waliLink.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        wali: {
          select: {
            id: true,
            name: true,
            profile: { select: { primaryImageUrl: true } },
          },
        },
      },
    });

    return links.map((link) => ({
      linkId: link.id,
      waliId: link.wali.id,
      waliName: link.wali.name,
      waliImage: link.wali.profile?.primaryImageUrl,
      status: link.status,
      permissions: {
        seeProfiles: link.seeProfiles,
        seeChats: link.seeChats,
        approveLikes: link.approveLikes,
        approveMatches: link.approveMatches,
        chatSummaries: link.chatSummaries,
        weeklyDigest: link.weeklyDigest,
        matchAlerts: link.matchAlerts,
      },
      acceptedAt: link.acceptedAt,
    }));
  }

  async getStatus(userId: string) {
    const link = await this.prisma.waliLink.findFirst({
      where: { userId, status: { in: ['active', 'pending'] } },
      include: { wali: { select: { name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      linked: link?.status === 'active',
      status: link?.status ?? 'notLinked',
      name: link?.wali.name ?? null,
      email: link?.wali.email ?? null,
      confirmedAt: link?.acceptedAt ?? null,
    };
  }

  async removeForUser(userId: string) {
    const links = await this.prisma.waliLink.findMany({
      where: { userId, status: { in: ['active', 'pending'] } },
      select: { id: true },
    });
    if (links.length) {
      await this.prisma.waliLink.updateMany({
        where: { id: { in: links.map((link) => link.id) } },
        data: { status: 'revoked', revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async updateDeliveryPreferences(userId: string, preferences: {
    chatSummaries?: boolean;
    weeklyDigest?: boolean;
    matchAlerts?: boolean;
  }) {
    const link = await this.prisma.waliLink.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!link) throw new NotFoundException('No active Wali link');
    return this.prisma.waliLink.update({
      where: { id: link.id },
      data: {
        ...(preferences.chatSummaries !== undefined && { chatSummaries: preferences.chatSummaries, seeChats: preferences.chatSummaries }),
        ...(preferences.weeklyDigest !== undefined && { weeklyDigest: preferences.weeklyDigest }),
        ...(preferences.matchAlerts !== undefined && { matchAlerts: preferences.matchAlerts }),
      },
    });
  }

  @Cron('0 9 * * 1')
  async sendWeeklyDigests() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const links = await this.prisma.waliLink.findMany({
      where: { status: 'active', weeklyDigest: true },
      include: {
        user: { select: { id: true, name: true } },
        wali: { select: { id: true, email: true } },
      },
    });

    for (const link of links) {
      const prior = await this.prisma.waliDigest.findUnique({
        where: { waliId_period_startDate: { waliId: link.waliId, period: 'weekly', startDate } },
        select: { id: true },
      });
      if (prior) continue;

      const [messages, matches] = await Promise.all([
        link.chatSummaries
          ? this.prisma.message.findMany({
              where: {
                createdAt: { gte: startDate, lte: endDate },
                conversation: { OR: [{ userAId: link.userId }, { userBId: link.userId }] },
              },
              include: { sender: { select: { name: true } } },
              orderBy: { createdAt: 'asc' },
              take: 80,
            })
          : Promise.resolve([]),
        link.matchAlerts
          ? this.prisma.match.count({
              where: {
                createdAt: { gte: startDate, lte: endDate },
                OR: [{ userAId: link.userId }, { userBId: link.userId }],
              },
            })
          : Promise.resolve(0),
      ]);
      if (!messages.length && !matches) continue;

      let digest: { id: string };
      try {
        digest = await this.prisma.waliDigest.create({
          data: {
            waliId: link.waliId,
            period: 'weekly',
            startDate,
            endDate,
            newMatches: matches,
            newMessages: messages.length,
            usersLinked: 1,
          },
          select: { id: true },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') continue;
        throw error;
      }

      const messageSummary = messages.length
        ? messages.slice(-20).map((message) => `${message.sender.name}: ${message.text.slice(0, 240)}`).join('\n')
        : 'No conversation messages were included in this digest.';
      const matchSummary = matches ? `New matches this week: ${matches}.` : 'No new matches this week.';
      try {
        await this.mail.sendWaliSummary({
          to: link.wali.email,
          userName: link.user.name,
          participantNames: `${link.user.name} weekly update`,
          summary: `${matchSummary}\n\n${messageSummary}`,
          messageCount: messages.length,
        });
        await this.prisma.waliDigest.update({ where: { id: digest.id }, data: { sentAt: new Date() } });
      } catch (error) {
        await this.prisma.waliDigest.delete({ where: { id: digest.id } }).catch(() => undefined);
        this.logger.error(`Could not send weekly Wali digest for ${link.id}: ${String(error)}`);
      }
    }
  }

  /**
   * Get protected users (users I'm wali for)
   */
  async getProtectedUsers(waliId: string) {
    const links = await this.prisma.waliLink.findMany({
      where: {
        waliId,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { primaryImageUrl: true } },
          },
        },
      },
    });

    return links.map((link) => ({
      linkId: link.id,
      userId: link.user.id,
      userName: link.user.name,
      userImage: link.user.profile?.primaryImageUrl,
      status: link.status,
      permissions: {
        seeProfiles: link.seeProfiles,
        seeChats: link.seeChats,
        approveLikes: link.approveLikes,
        approveMatches: link.approveMatches,
      },
    }));
  }

  /**
   * Revoke Wali access
   */
  async revokeWali(userId: string, linkId: string) {
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
    });

    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId)
      throw new ForbiddenException('Not your wali link');

    const updated = await this.prisma.waliLink.update({
      where: { id: linkId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    this.realtime.emitToUser(link.waliId, 'wali:link-revoked', {
      linkId,
    });

    return {
      linkId,
      status: 'revoked',
      revokedAt: updated.revokedAt,
    };
  }

  /**
   * Update Wali permissions
   */
  async updateWaliPermissions(
    userId: string,
    linkId: string,
    updates: WaliPermissionsUpdate,
  ) {
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
    });

    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId)
      throw new ForbiddenException('Not your wali link');

    const updated = await this.prisma.waliLink.update({
      where: { id: linkId },
      data: updates,
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────
  // APPROVAL WORKFLOW
  // ────────────────────────────────────────────────────────────────

  /**
   * Request Wali approval for an action
   */
  async requestApproval(
    userId: string,
    actionType: string,
    targetUserId: string,
    details: any,
  ) {
    // Get user's walis who have approval permissions
    const walis = await this.prisma.waliLink.findMany({
      where: {
        userId,
        status: 'active',
        approveLikes: actionType === 'like' ? true : undefined,
        approveMatches: ['match_accept', 'match_reject'].includes(actionType)
          ? true
          : undefined,
      },
    });

    if (walis.length === 0) {
      throw new BadRequestException('No walis available for approval');
    }

    // Create approval requests for all relevant walis
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const approvals = await Promise.all(
      walis.map((waliLink) =>
        this.prisma.waliApproval.create({
          data: {
            waliId: waliLink.waliId,
            userId,
            actionType,
            targetUserId,
            actionDetails: details,
            status: 'pending',
            expiresAt,
          },
        }),
      ),
    );

    // Notify walis
    for (const approval of approvals) {
      this.realtime.emitToUser(approval.waliId, 'wali:approval-requested', {
        approvalId: approval.id,
        userId,
        actionType,
        targetUserId,
      });
    }

    return {
      approvalId: approvals[0]?.id,
      status: 'pending',
      waliNotified: true,
      expiresAt,
    };
  }

  /**
   * Get pending approvals for a wali
   */
  async getPendingApprovals(waliId: string) {
    const approvals = await this.prisma.waliApproval.findMany({
      where: {
        waliId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { primaryImageUrl: true } },
          },
        },
      },
    });

    return approvals.map((a) => ({
      approvalId: a.id,
      userId: a.user.id,
      userName: a.user.name,
      actionType: a.actionType,
      targetUser: a.actionDetails,
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
    }));
  }

  /**
   * Approve or reject a Wali request
   */
  async respondToApproval(waliId: string, approvalId: string, action: string) {
    const approval = await this.prisma.waliApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.waliId !== waliId)
      throw new ForbiddenException('Not your approval');

    const updated = await this.prisma.waliApproval.update({
      where: { id: approvalId },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedAt: new Date(),
      },
    });

    // Notify user
    this.realtime.emitToUser(approval.userId, 'wali:approval-responded', {
      approvalId,
      status: updated.status,
    });

    return {
      approvalId,
      status: updated.status,
      userNotified: true,
      approvedAt: updated.approvedAt,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  /**
   * Get Wali statistics
   */
  async getWaliStats() {
    const totalLinks = await this.prisma.waliLink.count();
    const activeLinks = await this.prisma.waliLink.count({
      where: { status: 'active' },
    });
    const pendingInvites = await this.prisma.waliLink.count({
      where: { status: 'pending' },
    });

    return {
      totalWaliLinks: totalLinks,
      activeLinks,
      pendingInvites,
      rejectedLinks: await this.prisma.waliLink.count({
        where: { status: 'rejected' },
      }),
      usageByPermission: {
        seeProfiles: await this.prisma.waliLink.count({
          where: { seeProfiles: true },
        }),
        seeChats: await this.prisma.waliLink.count({
          where: { seeChats: true },
        }),
        approveLikes: await this.prisma.waliLink.count({
          where: { approveLikes: true },
        }),
        approveMatches: await this.prisma.waliLink.count({
          where: { approveMatches: true },
        }),
      },
    };
  }

  async listAllWali(status?: string, search?: string) {
    const links = await this.prisma.waliLink.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search } } },
                { wali: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        wali: { select: { id: true, name: true, email: true } },
      },
    });
    return links;
  }

  async updateAdminStatus(linkId: string, status: string) {
    if (!['pending', 'active', 'rejected', 'revoked'].includes(status)) {
      throw new BadRequestException('Invalid Wali status');
    }
    return this.prisma.waliLink.update({
      where: { id: linkId },
      data: { status },
    });
  }

  async getAdminSettings() {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { startsWith: 'wali.' } },
    });
    return Object.fromEntries(rows.map((row) => [row.key.slice(5), row.value]));
  }

  async updateAdminSettings(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values)) {
      await this.prisma.appSetting.upsert({
        where: { key: `wali.${key}` },
        update: { value: value as any },
        create: { key: `wali.${key}`, value: value as any },
      });
    }
    return this.getAdminSettings();
  }

  /**
   * Get user's Wali links (admin view)
   */
  async getUserWaliLinks(userId: string) {
    return this.prisma.waliLink.findMany({
      where: { userId },
      include: {
        wali: { select: { name: true } },
      },
    });
  }

  /**
   * Manage Wali link (admin)
   */
  async manageWaliLink(linkId: string, action: string) {
    return this.prisma.waliLink.update({
      where: { id: linkId },
      data: {
        status:
          action === 'suspend'
            ? 'revoked'
            : action === 'activate'
              ? 'active'
              : 'revoked',
      },
    });
  }
}
