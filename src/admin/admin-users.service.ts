import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { ManualVerificationStatus, Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { verificationDir } from 'src/upload/storage-paths';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { AdminUpdateUserDto, AdminUserQueryDto, CreateUserDto } from './dto';

// Practice label → prayerFrequency values it maps to (see practiceLabel()).
const PRACTICE_FREQUENCIES: Record<string, string[]> = {
  'Highly Practicing': ['fiveTimes'],
  Practicing: ['mostPrayers'],
  Moderately: ['jumuahOnly', 'sometimes'],
};
const KNOWN_FREQUENCIES = ['fiveTimes', 'mostPrayers', 'jumuahOnly', 'sometimes'];

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeBus,
  ) {}

  private calcAge(dob: Date | null | undefined): number | null {
    if (!dob) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  private practiceLabel(p: string | null | undefined): string {
    switch (p) {
      case 'fiveTimes':
        return 'Highly Practicing';
      case 'mostPrayers':
        return 'Practicing';
      case 'jumuahOnly':
      case 'sometimes':
        return 'Moderately';
      default:
        return 'Learning';
    }
  }

  private serialize(u: any) {
    const p = u.profile ?? {};
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      age: this.calcAge(p.dateOfBirth),
      gender: p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : null,
      country: p.country ?? null,
      city: p.city ?? null,
      practice: this.practiceLabel(p.prayerFrequency),
      sect: p.sect ?? null,
      status: u.status,
      role: u.role,
      verified: p.isVerified ?? false,
      premium: u.plan !== 'basic',
      plan: u.plan,
      completeness: p.completeness ?? 0,
      lastActive: u.lastSeenAt,
      joined: u.createdAt,
    };
  }

  async list(q: AdminUserQueryDto) {
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 25, 100);

    // Profile-relation conditions (verified + non-"Learning" practice) get
    // merged into a single `profile.is` so they don't clobber each other.
    const profileIs: Prisma.ProfileWhereInput = {};
    if (q.verified !== undefined) profileIs.isVerified = q.verified;
    if (q.practice && q.practice !== 'Learning' && PRACTICE_FREQUENCIES[q.practice]) {
      profileIs.prayerFrequency = { in: PRACTICE_FREQUENCIES[q.practice] as any };
    }

    const where: Prisma.UserWhereInput = {
      ...(q.status && { status: q.status as UserStatus }),
      ...(q.premium === true && { plan: { not: 'basic' } }),
      ...(q.premium === false && { plan: 'basic' }),
      ...(Object.keys(profileIs).length > 0 && { profile: { is: profileIs } }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search } },
          { email: { contains: q.search } },
        ],
      }),
    };

    // "Learning" = no recorded/known prayer frequency (incl. null / no profile).
    if (q.practice === 'Learning') {
      where.AND = [
        {
          OR: [
            { profile: { is: { prayerFrequency: { notIn: KNOWN_FREQUENCIES as any } } } },
            { profile: { is: { prayerFrequency: null } } },
            { profile: { is: null } },
          ],
        },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      results: users.map((u) => this.serialize(u)),
    };
  }

  /// Create a user or admin account directly from the dashboard. Pre-verified
  /// email since an admin is vouching for it.
  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const status = (dto.status ?? 'active') as UserStatus;
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: (dto.role ?? 'user') as Role,
        status,
        isActive: status === 'active' || status === 'pending',
        isEmailVerified: true,
        profile: { create: { ...(dto.gender && { gender: dto.gender }) } },
      },
      include: { profile: true },
    });

    this.realtime.emitAdminEvent(
      'moderation',
      `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} created`,
      { userId: user.id },
    );
    return this.serialize(user);
  }

  /// Full admin update of a user's account + profile details.
  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Guard email uniqueness when it changes.
    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
        select: { id: true },
      });
      if (clash) throw new ConflictException('Email already registered');
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) userData.name = dto.name;
    if (dto.email !== undefined) userData.email = dto.email;
    if (dto.password) userData.password = await bcrypt.hash(dto.password, 10);
    if (dto.role !== undefined) userData.role = dto.role as Role;
    if (dto.status !== undefined) {
      userData.status = dto.status as UserStatus;
      userData.isActive = dto.status === 'active' || dto.status === 'pending';
    }

    // Profile fields are upserted so a user without a profile row still works.
    // Plain scalar object so the same shape satisfies both update and create.
    const profileData: Record<string, unknown> = {};
    if (dto.gender !== undefined) profileData.gender = dto.gender;
    if (dto.city !== undefined) profileData.city = dto.city;
    if (dto.country !== undefined) profileData.country = dto.country;
    if (dto.profession !== undefined) profileData.profession = dto.profession;
    if (dto.bio !== undefined) profileData.bio = dto.bio;
    if (dto.dateOfBirth !== undefined) {
      profileData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }
    // Setting a gender makes the profile discover-eligible.
    if (dto.gender !== undefined) profileData.isComplete = !!dto.gender;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        ...(Object.keys(profileData).length > 0 && {
          profile: {
            upsert: {
              update: profileData as Prisma.ProfileUpdateWithoutUserInput,
              create: profileData as Prisma.ProfileCreateWithoutUserInput,
            },
          },
        }),
      },
      include: { profile: true },
    });

    if (dto.status && !(dto.status === 'active' || dto.status === 'pending')) {
      this.realtime.emitToUser(id, 'account:banned', { status: dto.status });
    }
    this.realtime.emitAdminEvent('moderation', `${updated.name} updated`, { userId: id });
    return this.serialize(updated);
  }

  /// Clears every like/pass the user has made so their discovery deck
  /// repopulates with profiles they'd already swiped on.
  async resetSwipes(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { count } = await this.prisma.like.deleteMany({ where: { fromUserId: id } });
    this.realtime.emitAdminEvent('moderation', `${user.name}'s discovery deck reset`, {
      userId: id,
    });
    return { id, cleared: count };
  }

  async getOne(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, photos: { orderBy: { position: 'asc' } } },
    });
    if (!u) throw new NotFoundException('User not found');
    return {
      ...this.serialize(u),
      bio: u.profile?.bio ?? null,
      phone: u.phone,
      photos: u.photos.map((ph) => ({ id: ph.id, url: ph.url, isPrivate: ph.isPrivate })),
    };
  }

  /// Set account status. `isActive` is kept in sync so existing guards/queries
  /// keep working; banning/suspending forces the user offline via a WS event.
  async setStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!user) throw new NotFoundException('User not found');

    const isActive = status === 'active' || status === 'pending';
    await this.prisma.user.update({
      where: { id },
      data: { status, isActive },
    });
    if (!isActive) {
      this.realtime.emitToUser(id, 'account:banned', { status });
    }
    const verb =
      status === 'banned' ? 'banned'
      : status === 'suspended' ? 'suspended'
      : status === 'active' ? 'reinstated'
      : status;
    this.realtime.emitAdminEvent('moderation', `${user.name} ${verb}`, { userId: id });
    return { id, status, isActive };
  }

  async setVerified(id: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { name: true } });
    await this.prisma.profile.upsert({
      where: { userId: id },
      update: { isVerified: verified },
      create: { userId: id, isVerified: verified },
    });
    this.realtime.emitAdminEvent(
      'moderation',
      `${user?.name ?? 'User'} ${verified ? 'verified' : 'unverified'}`,
      { userId: id },
    );
    return { id, verified };
  }

  /// Shaped to the dashboard's `VerificationStatus` type: flat phoneStatus /
  /// identityStatus, a plain phone string, and the submission under
  /// identitySubmission. `reviewedBy` is filled from the latest audit row for
  /// that kind, which is the only place the reviewer's identity is kept.
  async getVerification(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, identityVerification: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const identity = user.identityVerification;
    const lastIdentityReview = identity
      ? await this.prisma.verificationAudit.findFirst({
          where: { userId: id, kind: 'identity' },
          orderBy: { createdAt: 'desc' },
          select: { reviewedBy: true },
        })
      : null;

    return {
      userId: id,
      phone: user.phone ?? undefined,
      phoneStatus: user.phoneVerificationStatus,
      phoneReason: user.phoneVerificationReason,
      identityStatus: identity?.status ?? ManualVerificationStatus.notSubmitted,
      identitySubmission: identity
        ? {
            id: identity.id,
            userId: identity.userId,
            submittedAt: identity.createdAt.toISOString(),
            data: identity.submission,
            status: identity.status,
            reviewedAt: identity.reviewedAt?.toISOString() ?? undefined,
            reviewedBy: lastIdentityReview?.reviewedBy ?? undefined,
            reason: identity.reason ?? undefined,
            updatedAt: identity.updatedAt.toISOString(),
          }
        : undefined,
    };
  }

  /// Review trail for one member's verification. Returns a bare array of the
  /// dashboard's `VerificationAuditEntry` — the modal maps over the response
  /// directly, so it must not be wrapped in an envelope.
  async getVerificationAuditHistory(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const entries = await this.prisma.verificationAudit.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return entries.map((entry) => ({
      timestamp: entry.createdAt.toISOString(),
      reviewedBy: entry.reviewedBy ?? 'system',
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason ?? '',
      kind: entry.kind,
    }));
  }

  /// Verification review queue. `type` narrows to one kind, `status` picks the
  /// decision state (default pending), `search` matches name or email — the
  /// three controls the dashboard's VerificationFilters panel exposes.
  async listPendingVerifications(opts: {
    type?: 'phone' | 'identity';
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const status = (opts.status && opts.status !== 'all'
      ? opts.status
      : ManualVerificationStatus.pending) as ManualVerificationStatus;

    const phoneMatch: Prisma.UserWhereInput = { phoneVerificationStatus: status };
    const identityMatch: Prisma.UserWhereInput = {
      identityVerification: { status },
    };
    const kindWhere: Prisma.UserWhereInput =
      opts.type === 'phone'
        ? phoneMatch
        : opts.type === 'identity'
          ? identityMatch
          : { OR: [phoneMatch, identityMatch] };

    const search = opts.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          AND: [
            kindWhere,
            { OR: [{ name: { contains: search } }, { email: { contains: search } }] },
          ],
        }
      : kindWhere;

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip: Math.max(Number(opts.offset) || 0, 0),
        take: Math.min(Number(opts.limit) || 50, 200),
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          phoneVerificationStatus: true,
          identityVerification: {
            select: { status: true, createdAt: true, updatedAt: true },
          },
        },
      }),
    ]);

    return {
      total,
      // Field names follow the dashboard's `VerificationUser` type exactly —
      // the queue table reads user.username / phoneVerificationStatus /
      // identityVerificationStatus / lastSubmittedAt.
      users: users.map((user) => ({
        id: user.id,
        username: user.name,
        email: user.email,
        phone: user.phone ?? undefined,
        phoneVerificationStatus: user.phoneVerificationStatus,
        identityVerificationStatus:
          user.identityVerification?.status ??
          ManualVerificationStatus.notSubmitted,
        lastSubmittedAt:
          user.identityVerification?.updatedAt?.toISOString() ??
          user.createdAt.toISOString(),
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }

  async reviewPhoneVerification(
    id: string,
    status: string,
    reason?: string,
    reviewer?: { id: string; email: string },
  ) {
    const mapped = status as ManualVerificationStatus;
    const verified = mapped === ManualVerificationStatus.verified;
    const before = await this.prisma.user.findUnique({
      where: { id },
      select: { phoneVerificationStatus: true },
    });
    if (!before) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        phoneVerificationStatus: mapped,
        phoneVerificationReason: reason ?? null,
        isPhoneVerified: verified,
      },
      select: { id: true, name: true },
    });
    await this.recordVerificationAudit(
      id,
      'phone',
      before.phoneVerificationStatus,
      mapped,
      reason,
      reviewer,
    );
    await this.notifyVerification(id, 'phone', mapped, user.name);
    return { success: true, data: await this.getVerification(id) };
  }

  async reviewIdentityVerification(
    id: string,
    status: string,
    reason?: string,
    reviewer?: { id: string; email: string },
  ) {
    const mapped = status as ManualVerificationStatus;
    const before = await this.prisma.identityVerification.findUnique({
      where: { userId: id },
      select: { status: true },
    });
    if (!before) throw new NotFoundException('Verification submission not found');

    await this.prisma.identityVerification.update({
      where: { userId: id },
      data: { status: mapped, reason: reason ?? null, reviewedAt: new Date() },
    });
    const user = await this.prisma.user.findUnique({ where: { id }, select: { name: true } });
    if (!user) throw new NotFoundException('User not found');
    const phone = await this.prisma.user.findUnique({ where: { id }, select: { isPhoneVerified: true } });
    const complete = mapped === ManualVerificationStatus.verified && phone?.isPhoneVerified === true;
    if (complete) await this.prisma.profile.update({ where: { userId: id }, data: { isVerified: true } });
    await this.recordVerificationAudit(
      id,
      'identity',
      before.status,
      mapped,
      reason,
      reviewer,
    );
    await this.notifyVerification(id, 'identity', mapped, user.name);
    return { success: true, data: await this.getVerification(id), badgeVerified: complete };
  }

  /// One row per review decision, so the dashboard can show who changed what
  /// and why. Failures here must never fail the review itself.
  private async recordVerificationAudit(
    userId: string,
    kind: 'phone' | 'identity',
    previousStatus: ManualVerificationStatus,
    newStatus: ManualVerificationStatus,
    reason?: string,
    reviewer?: { id: string; email: string },
  ) {
    await this.prisma.verificationAudit
      .create({
        data: {
          userId,
          kind,
          previousStatus,
          newStatus,
          reason: reason ?? null,
          reviewedById: reviewer?.id ?? null,
          reviewedBy: reviewer?.email ?? null,
        },
      })
      .catch(() => undefined);
  }

  private async notifyVerification(id: string, kind: 'phone' | 'identity', status: ManualVerificationStatus, name: string) {
    const title = kind === 'phone' ? 'Phone verification updated' : 'Identity verification updated';
    const body = status === ManualVerificationStatus.verified
      ? `${kind === 'phone' ? 'Your phone number' : 'Your identity'} has been verified.`
      : status === ManualVerificationStatus.resubmissionRequired
        ? 'Additional information is required for your verification.'
        : `Your ${kind} verification status is ${status}.`;
    void this.push.sendToUser(id, { title, body, data: { type: 'verification', kind, status } });
    this.realtime.emitToUser(id, 'notification:new', { kind: 'verification', type: kind, status });
    this.realtime.emitAdminEvent('moderation', `${name} ${kind} verification changed to ${status}`, { userId: id, kind, status });
  }

  async getVerificationDocumentPath(id: string, documentId: string) {
    const verification = await this.prisma.identityVerification.findUnique({ where: { userId: id } });
    if (!verification) throw new NotFoundException('Verification submission not found');
    const documents = (verification.submission as any)?.documents ?? {};
    const document = Object.values(documents).find((value: any) => value?.documentId === documentId) as any;
    if (!document) throw new NotFoundException('Verification document not found');
    const userDir = verificationDir(id);
    // The directory is absent until the user's first upload, and readdirSync
    // would throw ENOENT (a 500) rather than the 404 this case deserves.
    if (!existsSync(userDir)) throw new NotFoundException('Verification file not found');
    const files = readdirSync(userDir);
    // documentId comes from the request; anchor the match to the generated
    // uuid prefix so it can't be used to reach a neighbouring file.
    const filename = files.find(
      (file) => file.slice(0, file.lastIndexOf('.')) === documentId,
    );
    if (!filename || !existsSync(join(userDir, filename))) throw new NotFoundException('Verification file not found');
    return { path: join(userDir, filename), originalName: document.originalName ?? filename };
  }

  /// Send an admin message → lands in the user's /inbox + push notification.
  async sendMessage(id: string, subject: string | undefined, body: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const msg = await this.prisma.inboxMessage.create({
      data: { userId: id, fromAdmin: true, subject: subject ?? null, body },
    });
    void this.push.sendToUser(id, {
      title: subject ?? 'Message from Halal Connect',
      body: body.length > 120 ? `${body.slice(0, 120)}…` : body,
      data: { type: 'inbox', messageId: msg.id },
    });
    this.realtime.emitToUser(id, 'notification:new', { kind: 'inbox' });
    return { id: msg.id };
  }
}
