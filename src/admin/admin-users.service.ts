import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
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
