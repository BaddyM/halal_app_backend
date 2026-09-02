import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeletionRequestStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConfirmDeletionDto,
  CreateDeletionRequestDto,
  RejectDeletionDto,
} from './dto';

/// Days an account stays deactivated before its row is purged, when an admin
/// confirms a request without hardDelete.
const SOFT_DELETE_GRACE_DAYS = 30;

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private serialize(request: {
    id: string;
    userId: string | null;
    email: string;
    phone: string | null;
    reason: string | null;
    status: DeletionRequestStatus;
    requestedAt: Date;
    scheduledPurgeAt: Date | null;
    handledAt: Date | null;
  }) {
    return {
      id: request.id,
      userId: request.userId,
      email: request.email,
      phone: request.phone,
      reason: request.reason,
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      scheduledPurgeAt: request.scheduledPurgeAt?.toISOString() ?? null,
      handledAt: request.handledAt?.toISOString() ?? null,
    };
  }

  /// Records an erasure request from the public form. The caller is never told
  /// whether the email matched an account — the controller returns the same
  /// body either way, so this endpoint can't be used to enumerate members.
  async requestFromPublicForm(dto: CreateDeletionRequestDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, phone: true },
    });

    // Collapse repeat submissions onto the open request rather than piling up
    // duplicates for the moderation queue.
    const open = await this.prisma.accountDeletionRequest.findFirst({
      where: { email, status: DeletionRequestStatus.pending },
    });
    if (open) {
      await this.prisma.accountDeletionRequest.update({
        where: { id: open.id },
        data: {
          phone: dto.phone ?? open.phone,
          reason: dto.reason ?? open.reason,
          userId: user?.id ?? open.userId,
        },
      });
      return open.id;
    }

    const created = await this.prisma.accountDeletionRequest.create({
      data: {
        userId: user?.id ?? null,
        email,
        phone: dto.phone ?? user?.phone ?? null,
        reason: dto.reason ?? null,
      },
    });
    return created.id;
  }

  /// Records an erasure request on behalf of a signed-in member (in-app
  /// Settings → Delete account), where the account is already known.
  async requestForUser(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const open = await this.prisma.accountDeletionRequest.findFirst({
      where: { userId, status: DeletionRequestStatus.pending },
    });
    if (open) return this.serialize(open);

    const created = await this.prisma.accountDeletionRequest.create({
      data: {
        userId,
        email: user.email,
        phone: user.phone,
        reason: reason ?? null,
      },
    });
    return this.serialize(created);
  }

  async listForAdmin(status?: string) {
    const filter =
      status && status !== 'all'
        ? { status: status as DeletionRequestStatus }
        : {};
    const requests = await this.prisma.accountDeletionRequest.findMany({
      where: filter,
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      take: 500,
    });
    return requests.map((request) => this.serialize(request));
  }

  async getForAdmin(id: string) {
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Deletion request not found');
    return this.serialize(request);
  }

  /// Approves the request. A hard delete removes the User row outright (every
  /// relation cascades); a soft delete deactivates the account and schedules
  /// the purge, so AuthGuard rejects the member's next request either way.
  async confirm(id: string, adminId: string | null, dto: ConfirmDeletionDto) {
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Deletion request not found');

    const hardDelete = dto.hardDelete ?? true;
    const now = new Date();
    const scheduledPurgeAt = hardDelete
      ? null
      : new Date(now.getTime() + SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

    if (request.userId) {
      if (hardDelete) {
        // The row may already be gone (member deleted from the app first),
        // which is not an error — the request still resolves as confirmed.
        await this.prisma.user
          .delete({ where: { id: request.userId } })
          .catch(() => {
            this.logger.warn(
              `Deletion request ${id}: user ${request.userId} already removed`,
            );
          });
      } else {
        await this.prisma.user
          .update({
            where: { id: request.userId },
            data: { isActive: false, status: 'suspended' },
          })
          .catch(() => undefined);
      }
    }

    // Deleting the user nulls userId via SET NULL, so re-set it only when the
    // account survives as a soft delete.
    const updated = await this.prisma.accountDeletionRequest.update({
      where: { id },
      data: {
        status: DeletionRequestStatus.confirmed,
        handledAt: now,
        handledById: adminId,
        hardDeleted: hardDelete,
        scheduledPurgeAt,
      },
    });
    return this.serialize(updated);
  }

  async reject(id: string, adminId: string | null, dto: RejectDeletionDto) {
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Deletion request not found');

    const updated = await this.prisma.accountDeletionRequest.update({
      where: { id },
      data: {
        status: DeletionRequestStatus.rejected,
        handledAt: new Date(),
        handledById: adminId,
        handledNote: dto.reason ?? null,
        scheduledPurgeAt: null,
      },
    });
    return this.serialize(updated);
  }
}
