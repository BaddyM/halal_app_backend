import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { getWaliLinkSecret } from 'src/auth/jwt-secret';

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

export interface WaliPolicySettings {
  waliEnabled: boolean;
  requireWaliForSisters: boolean;
  ccAllChats: boolean;
  ccDigestFrequency: 'instant' | 'daily' | 'weekly';
  waliApprovalForMatches: boolean;
  inviteExpiryDays: number;
}

const DEFAULT_WALI_POLICY: WaliPolicySettings = {
  waliEnabled: true,
  requireWaliForSisters: true,
  ccAllChats: true,
  ccDigestFrequency: 'daily',
  waliApprovalForMatches: true,
  inviteExpiryDays: 7,
};

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

  async getPolicySettings(): Promise<WaliPolicySettings> {
    const rows = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: Object.keys(DEFAULT_WALI_POLICY).map((key) => `wali.${key}`),
        },
      },
    });
    const stored = new Map(rows.map((row) => [row.key.slice(5), row.value]));
    const frequency = stored.get('ccDigestFrequency');
    const inviteExpiryDays = stored.get('inviteExpiryDays');
    return {
      waliEnabled:
        typeof stored.get('waliEnabled') === 'boolean'
          ? (stored.get('waliEnabled') as boolean)
          : DEFAULT_WALI_POLICY.waliEnabled,
      requireWaliForSisters:
        typeof stored.get('requireWaliForSisters') === 'boolean'
          ? (stored.get('requireWaliForSisters') as boolean)
          : DEFAULT_WALI_POLICY.requireWaliForSisters,
      ccAllChats:
        typeof stored.get('ccAllChats') === 'boolean'
          ? (stored.get('ccAllChats') as boolean)
          : DEFAULT_WALI_POLICY.ccAllChats,
      ccDigestFrequency:
        frequency === 'instant' || frequency === 'daily' || frequency === 'weekly'
          ? frequency
          : DEFAULT_WALI_POLICY.ccDigestFrequency,
      waliApprovalForMatches:
        typeof stored.get('waliApprovalForMatches') === 'boolean'
          ? (stored.get('waliApprovalForMatches') as boolean)
          : DEFAULT_WALI_POLICY.waliApprovalForMatches,
      inviteExpiryDays:
        typeof inviteExpiryDays === 'number' &&
        Number.isInteger(inviteExpiryDays) &&
        inviteExpiryDays >= 1 &&
        inviteExpiryDays <= 30
          ? inviteExpiryDays
          : DEFAULT_WALI_POLICY.inviteExpiryDays,
    };
  }

  async getMemberFeatureState(userId: string) {
    const [profile, policy] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { gender: true, waliEnabled: true },
      }),
      this.getPolicySettings(),
    ]);
    const eligible = profile?.gender === 'female';
    return {
      eligible,
      globalEnabled: policy.waliEnabled,
      enabled: eligible && policy.waliEnabled && profile?.waliEnabled !== false,
      requireWaliForSisters: policy.requireWaliForSisters,
      waliApprovalForMatches: policy.waliApprovalForMatches,
      ccAllChats: policy.ccAllChats,
      ccDigestFrequency: policy.ccDigestFrequency,
      inviteExpiryDays: policy.inviteExpiryDays,
    };
  }

  async assertMemberFeatureEnabled(userId: string) {
    const state = await this.getMemberFeatureState(userId);
    if (!state.eligible) {
      throw new ForbiddenException('Wali features are only available to female members.');
    }
    if (!state.globalEnabled) {
      throw new ForbiddenException('Wali features are currently disabled.');
    }
    if (!state.enabled) {
      throw new ForbiddenException('Enable Wali in your settings to continue.');
    }
    return state;
  }

  async setMemberFeatureEnabled(userId: string, enabled: boolean) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gender: true },
    });
    if (profile?.gender !== 'female') {
      throw new ForbiddenException('Wali settings are only available to female members.');
    }
    const policy = await this.getPolicySettings();
    if (enabled && !policy.waliEnabled) {
      throw new ForbiddenException('Wali features are currently disabled.');
    }
    await this.prisma.profile.update({
      where: { userId },
      data: { waliEnabled: enabled },
    });
    return { waliEnabled: enabled, globalEnabled: policy.waliEnabled };
  }

  async assertFemaleMember(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gender: true },
    });
    if (profile?.gender !== 'female') {
      throw new ForbiddenException('Wali settings are only available to female members.');
    }
  }

  async assertChatAllowed(userIds: string[]) {
    const policy = await this.getPolicySettings();
    if (!policy.waliEnabled || !policy.requireWaliForSisters) return;

    const profiles = await this.prisma.profile.findMany({
      where: { userId: { in: [...new Set(userIds)] }, gender: 'female' },
      select: { userId: true, waliEnabled: true },
    });
    for (const profile of profiles) {
      if (!profile.waliEnabled) continue;
      const activeWali = await this.prisma.waliLink.count({
        where: { userId: profile.userId, status: 'active' },
      });
      if (!activeWali) {
        throw new ForbiddenException(
          'A female member must have an active Wali before this chat can continue. They can turn off Wali in settings.',
        );
      }
    }
  }

  async sendInstantMessageSummary(
    userIds: string[],
    senderId: string,
    content: string,
    messageType: string,
  ) {
    const policy = await this.getPolicySettings();
    if (
      !policy.waliEnabled ||
      !policy.ccAllChats ||
      policy.ccDigestFrequency !== 'instant' ||
      messageType !== 'text'
    ) {
      return;
    }

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: [...new Set(userIds)] },
        gender: 'female',
        waliEnabled: true,
      },
      select: { userId: true, waliName: true },
    });
    if (!profiles.length) return;

    const links = await this.prisma.waliLink.findMany({
      where: {
        userId: { in: profiles.map((profile) => profile.userId) },
        status: 'active',
        seeChats: true,
        chatSummaries: true,
      },
      include: {
        user: { select: { id: true, name: true } },
        wali: { select: { email: true } },
      },
    });

    for (const link of links) {
      try {
        await this.mail.sendWaliSummary({
          to: link.wali.email,
          userName: link.user.name,
          participantNames: 'Conversation update',
          summary: `New message from ${senderId === link.userId ? link.user.name : 'the other participant'}:\n${content.slice(0, 1000)}`,
          messageCount: 1,
          frequency: 'instant',
        });
      } catch (error) {
        this.logger.error(`Instant Wali email failed for link ${link.id}: ${String(error)}`);
      }
    }
  }

  private async signInvitation(linkId: string, action: 'accept' | 'reject') {
    const policy = await this.getPolicySettings();
    const expiresAt = Date.now() + policy.inviteExpiryDays * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ linkId, action, expiresAt })).toString('base64url');
    const secret = getWaliLinkSecret(this.config);
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyInvitation(token: string, action: 'accept' | 'reject') {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new BadRequestException('Invalid invitation link');
    const secret = getWaliLinkSecret(this.config);
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
    await this.assertMemberFeatureEnabled(userId);
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

    // The link relation requires a user row, so an email-only identity is
    // created when needed. Guardians can accept and receive summaries by email
    // without ever signing in to or installing the app.
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
        invitationToken: await this.signInvitation(link.id, 'accept'),
        declineToken: await this.signInvitation(link.id, 'reject'),
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
    await this.assertMemberFeatureEnabled(userId);
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
      invitationToken: await this.signInvitation(link.id, 'accept'),
      declineToken: await this.signInvitation(link.id, 'reject'),
    });
    return this.prisma.waliLink.update({
      where: { id: link.id },
      data: { inviteSentAt: new Date() },
    });
  }

  async resendAdminInvite(linkId: string) {
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
      include: {
        user: { select: { name: true } },
        wali: { select: { id: true, name: true, email: true } },
      },
    });
    if (!link) throw new NotFoundException('Wali link not found');
    if (link.status !== 'pending') {
      throw new BadRequestException('Only pending Wali invitations can be resent');
    }

    await this.mail.sendWaliInvitation({
      to: link.wali.email,
      waliName: link.wali.name,
      userName: link.user.name,
      invitationToken: await this.signInvitation(link.id, 'accept'),
      declineToken: await this.signInvitation(link.id, 'reject'),
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
    if (data.action === 'accept') {
      await this.assertMemberFeatureEnabled(link.userId);
    }

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
    const feature = await this.getMemberFeatureState(userId);
    if (!feature.eligible) {
      return {
        eligible: false,
        enabled: false,
        globalEnabled: feature.globalEnabled,
        linked: false,
        status: 'unavailable',
        preferences: null,
      };
    }
    const link = await this.prisma.waliLink.findFirst({
      where: { userId, status: { in: ['active', 'pending'] } },
      include: { wali: { select: { name: true, email: true, phone: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      eligible: true,
      enabled: feature.enabled,
      globalEnabled: feature.globalEnabled,
      linked: link?.status === 'active',
      status: link?.status ?? 'notLinked',
      name: link?.wali.name ?? null,
      email: link?.wali.email ?? null,
      phone: link?.wali.phone ?? null,
      confirmedAt: link?.acceptedAt ?? null,
      preferences: link
        ? {
            chatSummaries: link.chatSummaries && link.seeChats,
            weeklyDigest: link.weeklyDigest,
            matchAlerts: link.matchAlerts,
          }
        : null,
    };
  }

  async removeForUser(userId: string) {
    await this.assertFemaleMember(userId);
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

  async updateDeliveryPreferences(
    userId: string,
    preferences: {
      waliEnabled?: boolean;
      chatSummaries?: boolean;
      weeklyDigest?: boolean;
      matchAlerts?: boolean;
    },
  ) {
    if (preferences.waliEnabled !== undefined) {
      const result = await this.setMemberFeatureEnabled(userId, preferences.waliEnabled);
      if (!preferences.waliEnabled || Object.keys(preferences).length === 1) return result;
    }

    await this.assertMemberFeatureEnabled(userId);
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
    const policy = await this.getPolicySettings();
    if (policy.ccDigestFrequency !== 'weekly') return;
    await this.sendScheduledDigests('weekly', 7, policy);
  }

  @Cron('0 9 * * *')
  async sendDailyDigests() {
    const policy = await this.getPolicySettings();
    if (policy.ccDigestFrequency !== 'daily') return;
    await this.sendScheduledDigests('daily', 1, policy);
  }

  private async sendScheduledDigests(
    period: 'daily' | 'weekly',
    days: number,
    policy: WaliPolicySettings,
  ) {
    if (!policy.waliEnabled) return;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
    const links = await this.prisma.waliLink.findMany({
      where: {
        status: 'active',
        weeklyDigest: true,
        user: { profile: { is: { gender: 'female', waliEnabled: true } } },
      },
      include: {
        user: { select: { id: true, name: true } },
        wali: { select: { id: true, email: true } },
      },
    });

    for (const link of links) {
      const prior = await this.prisma.waliDigest.findUnique({
        where: {
          waliId_period_startDate: {
            waliId: link.waliId,
            period,
            startDate: periodStart,
          },
        },
        select: { id: true },
      });
      if (prior) continue;

      const [messages, matches] = await Promise.all([
        policy.ccAllChats && link.seeChats && link.chatSummaries
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
            period,
            startDate: periodStart,
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
      const matchSummary = matches
        ? `New matches this ${period === 'daily' ? 'day' : 'week'}: ${matches}.`
        : `No new matches this ${period === 'daily' ? 'day' : 'week'}.`;
      try {
        await this.mail.sendWaliSummary({
          to: link.wali.email,
          userName: link.user.name,
          participantNames: `${link.user.name} ${period} update`,
          summary: `${matchSummary}\n\n${messageSummary}`,
          messageCount: messages.length,
          frequency: period,
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
    await this.assertMemberFeatureEnabled(userId);
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
    });

    if (!link) throw new NotFoundException('Link not found');
    if (link.userId !== userId)
      throw new ForbiddenException('Not your wali link');

    const updated = await this.prisma.waliLink.update({
      where: { id: linkId },
      data: {
        ...updates,
        ...(updates.seeChats !== undefined && {
          chatSummaries: updates.seeChats,
        }),
      },
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
    await this.assertMemberFeatureEnabled(userId);
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
        ...(status ? { status: status === 'declined' ? 'rejected' : status } : {}),
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: { select: { gender: true, waliRelation: true } },
          },
        },
        wali: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    return links.map((link) => ({
      id: link.id,
      userId: link.userId,
      userName: link.user.name,
      userEmail: link.user.email,
      userGender: link.user.profile?.gender ?? null,
      waliName: link.wali.name,
      waliEmail: link.wali.email,
      waliPhone: link.wali.phone,
      relationship: link.user.profile?.waliRelation ?? '',
      status: link.status === 'rejected' ? 'declined' : link.status,
      ccChats: link.seeChats,
      ccMatches: link.matchAlerts,
      approvalRequired: link.approveLikes || link.approveMatches,
      invitedAt: link.inviteSentAt,
      acceptedAt: link.acceptedAt,
      createdAt: link.createdAt,
    }));
  }

  async updateAdminStatus(linkId: string, status: string) {
    const normalizedStatus = status === 'declined' ? 'rejected' : status;
    if (!['pending', 'active', 'rejected', 'revoked'].includes(normalizedStatus)) {
      throw new BadRequestException('Invalid Wali status');
    }
    return this.prisma.waliLink.update({
      where: { id: linkId },
      data: { status: normalizedStatus },
    });
  }

  async updateDashboardLink(
    linkId: string,
    input: {
      status?: unknown;
      ccChats?: unknown;
      ccMatches?: unknown;
      approvalRequired?: unknown;
      relationship?: unknown;
    },
  ) {
    const current = await this.prisma.waliLink.findUnique({ where: { id: linkId } });
    if (!current) throw new NotFoundException('Wali link not found');
    const data: Prisma.WaliLinkUpdateInput = {};

    if (input.status !== undefined) {
      const status = input.status === 'declined' ? 'rejected' : input.status;
      if (typeof status !== 'string' || !['pending', 'active', 'rejected', 'revoked'].includes(status)) {
        throw new BadRequestException('Invalid Wali status');
      }
      data.status = status;
    }
    if (input.ccChats !== undefined) {
      if (typeof input.ccChats !== 'boolean') throw new BadRequestException('ccChats must be a boolean');
      data.seeChats = input.ccChats;
      data.chatSummaries = input.ccChats;
    }
    if (input.ccMatches !== undefined) {
      if (typeof input.ccMatches !== 'boolean') throw new BadRequestException('ccMatches must be a boolean');
      data.matchAlerts = input.ccMatches;
    }
    if (input.approvalRequired !== undefined) {
      if (typeof input.approvalRequired !== 'boolean') {
        throw new BadRequestException('approvalRequired must be a boolean');
      }
      data.approveLikes = input.approvalRequired;
      data.approveMatches = input.approvalRequired;
    }
    if (input.relationship !== undefined && typeof input.relationship !== 'string') {
      throw new BadRequestException('relationship must be a string');
    }
    if (!Object.keys(data).length && input.relationship === undefined) {
      throw new BadRequestException('No supported Wali link fields were provided');
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.relationship !== undefined) {
        await tx.profile.upsert({
          where: { userId: current.userId },
          create: { userId: current.userId, waliRelation: input.relationship as string },
          update: { waliRelation: input.relationship as string },
        });
      }
      return tx.waliLink.update({
        where: { id: linkId },
        data,
        include: {
          user: { select: { id: true, name: true, email: true } },
          wali: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });
  }

  /// Hard-removes a guardian link from the admin console. Revoking (see
  /// updateAdminStatus) keeps the row for audit; this is for links created in
  /// error, which should leave no trace on either member's profile.
  async deleteAdminLink(linkId: string) {
    const link = await this.prisma.waliLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Wali link not found');
    await this.prisma.waliLink.delete({ where: { id: linkId } });
    return { success: true, id: linkId };
  }

  // ── Guardian digests ────────────────────────────────────────────
  /// Activity for one guardian link over [days], counted from the protected
  /// user's own records. Used both to preview a digest and to build the one
  /// that gets emailed.
  private async digestFor(linkId: string, days = 7) {
    const link = await this.prisma.waliLink.findUnique({
      where: { id: linkId },
      include: {
        wali: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true } },
      },
    });
    if (!link) throw new NotFoundException('Wali link not found');

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const window = { gte: startDate, lte: endDate };
    const userId = link.userId;
    const policy = await this.getPolicySettings();

    const [newMatches, newLikes, newMessages, usersLinked] = await Promise.all([
      link.matchAlerts
        ? this.prisma.match.count({
            where: {
              createdAt: window,
              OR: [{ userAId: userId }, { userBId: userId }],
            },
          })
        : Promise.resolve(0),
      // The Like table also stores passes; a guardian digest should count
      // genuine interest only.
      this.prisma.like.count({
        where: { createdAt: window, toUserId: userId, type: { in: ['like', 'superLike'] } },
      }),
      policy.ccAllChats && link.seeChats && link.chatSummaries
        ? this.prisma.message.count({
            where: { createdAt: window, senderId: userId },
          })
        : Promise.resolve(0),
      this.prisma.waliLink.count({ where: { waliId: link.waliId, status: 'active' } }),
    ]);

    return {
      link,
      period: days === 7 ? 'weekly' : 'monthly',
      startDate,
      endDate,
      newMatches,
      newLikes,
      newMessages,
      usersLinked,
    };
  }

  /// Read-only counts an admin can inspect before sending anything.
  async digestPreview(linkId: string, days = 7) {
    const d = await this.digestFor(linkId, days);
    return {
      linkId,
      waliId: d.link.waliId,
      waliName: d.link.wali.name,
      userName: d.link.user.name,
      period: d.period,
      startDate: d.startDate.toISOString(),
      endDate: d.endDate.toISOString(),
      newMatches: d.newMatches,
      newLikes: d.newLikes,
      newMessages: d.newMessages,
      usersLinked: d.usersLinked,
    };
  }

  /// Emails the guardian their digest and records it. Skips quiet periods so a
  /// wali is not mailed a summary of nothing.
  async sendDigest(linkId: string, days = 7) {
    const d = await this.digestFor(linkId, days);
    const member = await this.getMemberFeatureState(d.link.userId);
    if (!member.enabled) {
      return {
        linkId,
        waliId: d.link.waliId,
        sent: false,
        reason: 'Wali feature is disabled for this member',
      };
    }
    const hasActivity = d.newMatches + d.newLikes + d.newMessages > 0;
    if (!hasActivity) {
      return { linkId, waliId: d.link.waliId, sent: false, reason: 'No activity in this period' };
    }
    if (d.link.status !== 'active') {
      return { linkId, waliId: d.link.waliId, sent: false, reason: `Link is ${d.link.status}` };
    }

    // The unique key is (waliId, period, startDate); round the start to the day
    // so repeated sends inside one period update rather than duplicate.
    const periodStart = new Date(d.startDate);
    periodStart.setHours(0, 0, 0, 0);

    const summary = `${d.newMatches} new match(es), ${d.newLikes} like(s) received and ${d.newMessages} message(s) sent.`;
    let sent = false;
    try {
      await this.mail.sendWaliSummary({
        to: d.link.wali.email,
        userName: d.link.user.name,
        participantNames: d.link.user.name,
        summary,
        messageCount: d.newMessages,
        frequency: days === 1 ? 'daily' : 'weekly',
      });
      sent = true;
    } catch (error: any) {
      this.logger.warn(`Wali digest email failed for link ${linkId}: ${error.message}`);
    }

    await this.prisma.waliDigest.upsert({
      where: {
        waliId_period_startDate: {
          waliId: d.link.waliId,
          period: d.period,
          startDate: periodStart,
        },
      },
      update: {
        newMatches: d.newMatches,
        newLikes: d.newLikes,
        newMessages: d.newMessages,
        usersLinked: d.usersLinked,
        endDate: d.endDate,
        ...(sent && { sentAt: new Date() }),
      },
      create: {
        waliId: d.link.waliId,
        period: d.period,
        startDate: periodStart,
        endDate: d.endDate,
        newMatches: d.newMatches,
        newLikes: d.newLikes,
        newMessages: d.newMessages,
        usersLinked: d.usersLinked,
        sentAt: sent ? new Date() : null,
      },
    });

    return {
      linkId,
      waliId: d.link.waliId,
      sent,
      reason: sent ? undefined : 'Email delivery unavailable',
      summary,
    };
  }

  /// Fans the digest out across every active link. Returns per-link outcomes so
  /// an admin can see which guardians were actually mailed.
  async sendDigestToAll(days = 7) {
    const links = await this.prisma.waliLink.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
    const results: Array<{ linkId: string; sent: boolean; reason?: string }> = [];
    for (const link of links) {
      try {
        const r = await this.sendDigest(link.id, days);
        results.push({ linkId: link.id, sent: r.sent, reason: r.reason });
      } catch (error: any) {
        results.push({ linkId: link.id, sent: false, reason: error.message });
      }
    }
    return {
      total: results.length,
      sent: results.filter((r) => r.sent).length,
      results,
    };
  }

  /// Approval requests a guardian has been asked to act on.
  async listApprovals(status = 'pending') {
    const approvals = await this.prisma.waliApproval.findMany({
      where: status && status !== 'all' ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        wali: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return approvals.map((a) => ({
      id: a.id,
      waliId: a.waliId,
      waliName: a.wali.name,
      waliEmail: a.wali.email,
      userId: a.userId,
      userName: a.user.name,
      actionType: a.actionType,
      targetUserId: a.targetUserId,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      expiresAt: a.expiresAt.toISOString(),
      approvedAt: a.approvedAt?.toISOString() ?? null,
      expired: a.status === 'pending' && a.expiresAt.getTime() < Date.now(),
    }));
  }

  async getAdminSettings() {
    return this.getPolicySettings();
  }

  async updateAdminSettings(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in DEFAULT_WALI_POLICY)) {
        throw new BadRequestException(`Unsupported Wali setting: ${key}`);
      }
      if (
        key === 'ccDigestFrequency' &&
        value !== 'instant' &&
        value !== 'daily' &&
        value !== 'weekly'
      ) {
        throw new BadRequestException('ccDigestFrequency must be instant, daily, or weekly');
      }
      if (key === 'inviteExpiryDays' && (
        typeof value !== 'number' ||
          !Number.isInteger(value) ||
          value < 1 ||
        value > 30
      )) {
        throw new BadRequestException('inviteExpiryDays must be an integer from 1 to 30');
      }
      if (
        key !== 'ccDigestFrequency' &&
        key !== 'inviteExpiryDays' &&
        typeof value !== 'boolean'
      ) {
        throw new BadRequestException(`${key} must be a boolean`);
      }
      await this.prisma.appSetting.upsert({
        where: { key: `wali.${key}` },
        update: { value: value as boolean | number | string },
        create: { key: `wali.${key}`, value: value as boolean | number | string },
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
