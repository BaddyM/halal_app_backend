import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ManualVerificationStatus } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

export type VerificationType = 'phone' | 'photo' | 'id';

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService, private readonly push: PushService, private readonly realtime: RealtimeBus) {}

  async status(userId: string) {
    const [user, identity, photo] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
      this.prisma.identityVerification.findUnique({ where: { userId } }),
      this.prisma.profilePhotoVerification.findUnique({ where: { userId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    return {
      phone: { number: user.phone, status: user.phoneVerificationStatus, reason: user.phoneVerificationReason },
      photo: photo ? { status: photo.status, reason: photo.reason, submittedAt: photo.createdAt } : { status: 'notSubmitted', reason: null },
      id: identity ? { status: identity.status, reason: identity.reason, submittedAt: identity.createdAt } : { status: 'notSubmitted', reason: null },
      badge: { verified: user.profile?.isVerified === true },
    };
  }

  async submitPhoto(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selfie file is required');
    const record = await this.prisma.profilePhotoVerification.upsert({
      where: { userId },
      update: {
        submission: { filename: file.filename, originalName: file.originalname, mimeType: file.mimetype },
        status: 'pending', reason: null, reviewedAt: null,
      },
      create: {
        userId,
        submission: { filename: file.filename, originalName: file.originalname, mimeType: file.mimetype },
      },
    });
    return { status: record.status, submittedAt: record.createdAt };
  }

  async queue(type?: VerificationType, status = 'pending') {
    const selected = (['phone', 'photo', 'id'] as VerificationType[]).filter((value) => !type || value === type);
    const result: any[] = [];
    if (selected.includes('phone')) {
      const rows = await this.prisma.user.findMany({
        where: { phoneVerificationStatus: status as ManualVerificationStatus },
        select: { id: true, name: true, email: true, phone: true, phoneVerificationStatus: true, phoneVerificationReason: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      });
      result.push(...rows.map((row) => ({ type: 'phone', userId: row.id, name: row.name, email: row.email, status: row.phoneVerificationStatus, reason: row.phoneVerificationReason, submission: { phone: row.phone }, createdAt: row.updatedAt })));
    }
    if (selected.includes('photo')) {
      const rows = await this.prisma.profilePhotoVerification.findMany({
        where: { status: status as ManualVerificationStatus }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' },
      });
      result.push(...rows.map((row) => ({ type: 'photo', userId: row.userId, name: row.user.name, email: row.user.email, status: row.status, reason: row.reason, submission: row.submission, createdAt: row.createdAt })));
    }
    if (selected.includes('id')) {
      const rows = await this.prisma.identityVerification.findMany({
        where: { status: status as ManualVerificationStatus }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' },
      });
      result.push(...rows.map((row) => ({ type: 'id', userId: row.userId, name: row.user.name, email: row.user.email, status: row.status, reason: row.reason, submission: row.submission, createdAt: row.createdAt })));
    }
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async adminDetails(userId: string) {
    const [user, identity, photo] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, phoneVerificationStatus: true, phoneVerificationReason: true } }),
      this.prisma.identityVerification.findUnique({ where: { userId } }),
      this.prisma.profilePhotoVerification.findUnique({ where: { userId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    return {
      userId,
      phoneStatus: user.phoneVerificationStatus,
      identityStatus: identity?.status ?? 'notSubmitted',
      photoStatus: photo?.status ?? 'notSubmitted',
      phone: { number: user.phone, status: user.phoneVerificationStatus, reason: user.phoneVerificationReason },
      identity: identity ? { status: identity.status, reason: identity.reason, submission: identity.submission, submittedAt: identity.createdAt, reviewedAt: identity.reviewedAt } : null,
      photo: photo ? { status: photo.status, reason: photo.reason, submission: photo.submission, submittedAt: photo.createdAt, reviewedAt: photo.reviewedAt } : null,
    };
  }

  async dashboardQueue(input: { type?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const status = input.status && input.status !== 'all' ? input.status as ManualVerificationStatus : undefined;
    const type = input.type === 'identity' ? 'id' : input.type;
    const or: any[] = [];
    if (!type || type === 'phone') or.push({ phoneVerificationStatus: status ?? { not: 'notSubmitted' } });
    if (!type || type === 'id') or.push({ identityVerification: { is: status ? { status } : { status: { not: 'notSubmitted' } } } });
    if (!type || type === 'photo') or.push({ photoVerification: { is: status ? { status } : { status: { not: 'notSubmitted' } } } });
    const where: any = {
      OR: or,
      ...(input.search ? { AND: [{ OR: [
        { name: { contains: input.search } },
        { email: { contains: input.search } },
        { phone: { contains: input.search } },
      ] }] } : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, phoneVerificationStatus: true,
          identityVerification: { select: { status: true, submission: true, reason: true, createdAt: true, reviewedAt: true } },
          photoVerification: { select: { status: true, submission: true, reason: true, createdAt: true, reviewedAt: true } },
          updatedAt: true,
        },
        orderBy: { updatedAt: 'asc' },
        skip: Math.max(0, input.offset ?? 0),
        take: Math.min(100, Math.max(1, input.limit ?? 50)),
      }),
    ]);
    return {
      users: users.map((user) => ({
        id: user.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerificationStatus: user.phoneVerificationStatus,
        identityVerificationStatus: user.identityVerification?.status ?? 'notSubmitted',
        photoVerificationStatus: user.photoVerification?.status ?? 'notSubmitted',
        identitySubmission: user.identityVerification,
        photoSubmission: user.photoVerification,
        lastSubmittedAt: user.identityVerification?.createdAt ?? user.photoVerification?.createdAt ?? user.updatedAt,
      })),
      total,
    };
  }

  async verificationAudit(userId: string) {
    const entries = await this.prisma.auditLog.findMany({
      where: { action: { startsWith: 'verification ' }, target: { contains: userId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return entries.map((entry) => ({ id: entry.id, action: entry.action, adminEmail: entry.adminEmail, createdAt: entry.createdAt }));
  }

  async review(userId: string, type: VerificationType, decision: 'approve' | 'reject' | 'resubmissionRequired', reason?: string, adminId?: string, adminEmail?: string) {
    const status: ManualVerificationStatus = decision === 'approve' ? 'verified' : decision === 'reject' ? 'rejected' : 'resubmissionRequired';
    let name = 'User';
    if (type === 'phone') {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { phoneVerificationStatus: status, phoneVerificationReason: reason ?? null, isPhoneVerified: decision === 'approve' },
        select: { name: true },
      });
      name = user.name;
    } else if (type === 'photo') {
      const photo = await this.prisma.profilePhotoVerification.update({
        where: { userId }, data: { status, reason: reason ?? null, reviewedAt: new Date() },
        include: { user: { select: { name: true } } },
      });
      name = photo.user.name;
    } else if (type === 'id') {
      const identity = await this.prisma.identityVerification.update({
        where: { userId }, data: { status, reason: reason ?? null, reviewedAt: new Date() },
        include: { user: { select: { name: true } } },
      });
      name = identity.user.name;
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isPhoneVerified: true } });
      if (decision === 'approve' && user?.isPhoneVerified) {
        await this.prisma.profile.update({ where: { userId }, data: { isVerified: true } });
      }
    } else {
      throw new BadRequestException('Unknown verification type');
    }
    if (type !== 'photo') {
      const [phone, identity] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { isPhoneVerified: true } }),
        this.prisma.identityVerification.findUnique({ where: { userId }, select: { status: true } }),
      ]);
      await this.prisma.profile.updateMany({
        where: { userId },
        data: { isVerified: phone?.isPhoneVerified === true && identity?.status === 'verified' },
      });
    }
    if (adminId) {
      await this.prisma.auditLog.create({ data: {
        adminId,
        adminEmail,
        action: `verification ${type} ${status}`,
        target: JSON.stringify({ userId, reason: reason ?? null }),
      } });
    }
    void this.push.sendToUser(userId, {
      title: `${type.toUpperCase()} verification updated`,
      body: decision === 'approve' ? 'Your verification was approved.' : (reason ?? (decision === 'resubmissionRequired' ? 'Additional information is needed for your verification.' : 'Your verification was not approved.')),
      data: { type: 'verification', verificationType: type, status },
    });
    this.realtime.emitToUser(userId, 'notification:new', { kind: 'verification', verificationType: type, status });
    this.realtime.emitAdminEvent('moderation', `${name} ${type} verification ${status}`, { userId, type, status });
    return { userId, type, status, reason: reason ?? null };
  }

  async photoDocumentPath(userId: string) {
    const record = await this.prisma.profilePhotoVerification.findUnique({ where: { userId } });
    if (!record) throw new NotFoundException('Photo verification not found');
    const submission = record.submission as any;
    const path = join(process.cwd(), 'uploads', 'verification', userId, 'photo', submission.filename);
    if (!existsSync(path)) throw new NotFoundException('Photo document not found');
    return { path, originalName: submission.originalName ?? submission.filename };
  }
}
