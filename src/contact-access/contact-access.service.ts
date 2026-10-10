import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    HttpStatus,
    InternalServerErrorException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ContactAccessRequestStatus,
    Prisma,
    SubscriptionPlan,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushService } from 'src/push/push.service';

const PREMIUM_DAILY_LIMIT_DEFAULT = 5;

@Injectable()
export class ContactAccessService {
    private readonly logger = new Logger(ContactAccessService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly push: PushService,
    ) {}

    private dailyLimit(plan: SubscriptionPlan, planExpiresAt: Date | null, now: Date) {
        const isPremium =
            plan !== 'basic' && (!planExpiresAt || planExpiresAt.getTime() > now.getTime());
        if (!isPremium) return 1;

        const raw = this.config.get<string>('CONTACT_REQUEST_PREMIUM_DAILY_LIMIT');
        if (raw === undefined || raw.trim() === '') return PREMIUM_DAILY_LIMIT_DEFAULT;
        const configured = Number(raw);
        if (!Number.isSafeInteger(configured) || configured < 2 || configured > 100) {
            this.logger.error('CONTACT_REQUEST_PREMIUM_DAILY_LIMIT must be an integer from 2 to 100');
            throw new InternalServerErrorException('Invalid contact request limit configuration');
        }
        return configured;
    }

    private utcDayStart(now: Date): Date {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }

    private async quota(userId: string, now = new Date()) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true, planExpiresAt: true },
        });
        if (!user) throw new NotFoundException('User not found');
        const limit = this.dailyLimit(user.plan, user.planExpiresAt, now);
        const isPremium = limit > 1;
        const used = await this.prisma.contactAccessRequest.count({
            where: { requesterId: userId, createdAt: { gte: this.utcDayStart(now) } },
        });
        return {
            used,
            limit,
            remaining: Math.max(0, limit - used),
            isPremium,
            timezone: 'UTC',
        };
    }

    async status(userId: string, targetId: string) {
        if (userId === targetId) throw new BadRequestException('You cannot request your own contact details');
        const [request, quota] = await Promise.all([
            this.prisma.contactAccessRequest.findUnique({
                where: { requesterId_recipientId: { requesterId: userId, recipientId: targetId } },
                select: { id: true, status: true, createdAt: true, decidedAt: true },
            }),
            this.quota(userId),
        ]);
        return { request, quota };
    }

    async list(userId: string) {
        const [incoming, outgoing, quota] = await Promise.all([
            this.prisma.contactAccessRequest.findMany({
                where: { recipientId: userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    requester: {
                        select: {
                            id: true,
                            name: true,
                            profile: { select: { dateOfBirth: true, city: true, country: true } },
                            photos: {
                                where: { isPrivate: false, moderationStatus: 'approved' },
                                select: { url: true },
                                orderBy: { position: 'asc' },
                                take: 1,
                            },
                        },
                    },
                },
            }),
            this.prisma.contactAccessRequest.findMany({
                where: { requesterId: userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    recipient: {
                        select: {
                            id: true,
                            name: true,
                            profile: { select: { dateOfBirth: true, city: true, country: true } },
                            photos: {
                                where: { isPrivate: false, moderationStatus: 'approved' },
                                select: { url: true },
                                orderBy: { position: 'asc' },
                                take: 1,
                            },
                        },
                    },
                },
            }),
            this.quota(userId),
        ]);
        const member = (user: {
            id: string;
            name: string;
            profile: { dateOfBirth: Date | null; city: string | null; country: string | null } | null;
            photos: { url: string }[];
        }) => {
            const profile = user.profile;
            const photo = user.photos[0]?.url ?? null;
            let age: number | null = null;
            if (profile?.dateOfBirth) {
                const today = new Date();
                age = today.getFullYear() - profile.dateOfBirth.getFullYear();
                if (
                    today.getMonth() < profile.dateOfBirth.getMonth() ||
                    (today.getMonth() === profile.dateOfBirth.getMonth() &&
                        today.getDate() < profile.dateOfBirth.getDate())
                ) {
                    age--;
                }
            }
            return {
                id: user.id,
                name: user.name,
                age,
                location: [profile?.city, profile?.country].filter(Boolean).join(', '),
                imageUrl: photo,
            };
        };
        const serialize = (request: any, other: Parameters<typeof member>[0]) => ({
            id: request.id,
            status: request.status,
            createdAt: request.createdAt,
            decidedAt: request.decidedAt,
            member: member(other),
        });
        return {
            incoming: incoming.map((request) => serialize(request, request.requester)),
            outgoing: outgoing.map((request) => serialize(request, request.recipient)),
            quota,
        };
    }

    async create(requesterId: string, recipientId: string) {
        if (requesterId === recipientId) {
            throw new BadRequestException('You cannot request your own contact details');
        }

        const now = new Date();
        let created: { id: string; requesterName: string; recipientId: string };
        try {
            created = await this.prisma.$transaction(async (tx) => {
                // Serialize requests per sender so simultaneous calls cannot exceed the daily quota.
                const locked = await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT \`id\` FROM \`User\` WHERE \`id\` = ${requesterId} FOR UPDATE
                `;
                if (locked.length === 0) throw new NotFoundException('User not found');

                const [requester, recipient, existing, block] = await Promise.all([
                    tx.user.findUnique({
                        where: { id: requesterId },
                        select: { id: true, name: true, plan: true, planExpiresAt: true, isActive: true, status: true },
                    }),
                    tx.user.findUnique({
                        where: { id: recipientId },
                        select: { id: true, name: true, isActive: true, status: true, profileVisibility: true },
                    }),
                    tx.contactAccessRequest.findUnique({
                        where: { requesterId_recipientId: { requesterId, recipientId } },
                        select: { id: true, status: true },
                    }),
                    tx.block.findFirst({
                        where: {
                            OR: [
                                { blockerId: requesterId, blockedId: recipientId },
                                { blockerId: recipientId, blockedId: requesterId },
                            ],
                        },
                        select: { id: true },
                    }),
                ]);
                if (!requester || !recipient) throw new NotFoundException('User not found');
                if (!requester.isActive || requester.status !== 'active' || !recipient.isActive || recipient.status !== 'active') {
                    throw new ForbiddenException('Contact requests are unavailable for this account');
                }
                if (block) throw new ForbiddenException('Contact requests are unavailable for this member');
                if (recipient.profileVisibility !== 'everyone' && recipient.profileVisibility !== 'matchesOnly') {
                    throw new ForbiddenException('This member is not accepting contact requests');
                }
                if (recipient.profileVisibility === 'matchesOnly') {
                    const [a, b] = [requesterId, recipientId].sort();
                    const match = await tx.match.findUnique({
                        where: { userAId_userBId: { userAId: a, userBId: b } },
                        select: { id: true },
                    });
                    if (!match) throw new NotFoundException('Member not found');
                }
                if (existing) {
                    throw new ConflictException(
                        existing.status === 'declined'
                            ? 'This member has already declined a contact request'
                            : 'A contact request already exists for this member',
                    );
                }

                const limit = this.dailyLimit(requester.plan, requester.planExpiresAt, now);
                const used = await tx.contactAccessRequest.count({
                    where: { requesterId, createdAt: { gte: this.utcDayStart(now) } },
                });
                if (used >= limit) {
                    throw new HttpException(
                        `Daily contact request limit reached (${limit}). Premium members have a higher daily allowance.`,
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }

                const request = await tx.contactAccessRequest.create({
                    data: { requesterId, recipientId, createdAt: now },
                    select: { id: true },
                });
                return { id: request.id, requesterName: requester.name, recipientId };
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('A contact request already exists for this member');
            }
            throw error;
        }

        await this.push.sendToUser(created.recipientId, {
            title: 'Contact request',
            body: `${created.requesterName} asked to share contact details.`,
            data: { type: 'contact_access_request', requestId: created.id },
        });
        return {
            request: { id: created.id, status: 'pending' as const, createdAt: now, decidedAt: null },
            quota: await this.quota(requesterId, now),
        };
    }

    async decide(recipientId: string, requestId: string, approve: boolean) {
        const request = await this.prisma.contactAccessRequest.findUnique({
            where: { id: requestId },
            include: {
                requester: { select: { id: true, name: true, isActive: true, status: true } },
                recipient: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        status: true,
                        profileVisibility: true,
                    },
                },
            },
        });
        if (!request) throw new NotFoundException('Contact request not found');
        if (request.recipientId !== recipientId) throw new ForbiddenException('You cannot decide this request');
        if (request.status !== 'pending') throw new ConflictException('This contact request is no longer pending');
        if (
            !request.requester.isActive ||
            request.requester.status !== 'active' ||
            !request.recipient.isActive ||
            request.recipient.status !== 'active'
        ) {
            throw new ForbiddenException('Contact requests are unavailable for this account');
        }
        const block = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: request.requesterId, blockedId: recipientId },
                    { blockerId: recipientId, blockedId: request.requesterId },
                ],
            },
            select: { id: true },
        });
        if (block) throw new ForbiddenException('Contact requests are unavailable for this member');
        if (
            approve &&
            request.recipient.profileVisibility !== 'everyone' &&
            request.recipient.profileVisibility !== 'matchesOnly'
        ) {
            throw new ForbiddenException('This member is not accepting contact requests');
        }
        if (approve && request.recipient.profileVisibility === 'matchesOnly') {
            const [a, b] = [request.requesterId, recipientId].sort();
            const match = await this.prisma.match.findUnique({
                where: { userAId_userBId: { userAId: a, userBId: b } },
                select: { id: true },
            });
            if (!match) throw new ForbiddenException('Contact requests are unavailable for this member');
        }

        const status: ContactAccessRequestStatus = approve ? 'approved' : 'declined';
        const decidedAt = new Date();
        const changed = await this.prisma.contactAccessRequest.updateMany({
            where: { id: requestId, recipientId, status: 'pending' },
            data: { status, decidedAt },
        });
        if (changed.count !== 1) throw new ConflictException('This contact request is no longer pending');

        await this.push.sendToUser(request.requesterId, {
            title: 'Contact request update',
            body: approve
                ? `${request.recipient.name} approved your contact request.`
                : 'Your contact request was declined.',
            data: { type: 'contact_access_request', requestId, status },
        });
        return { id: requestId, status, decidedAt };
    }

    async revoke(userId: string, requestId: string) {
        const request = await this.prisma.contactAccessRequest.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true, recipientId: true, status: true },
        });
        if (!request) throw new NotFoundException('Contact request not found');
        if (request.requesterId !== userId && request.recipientId !== userId) {
            throw new ForbiddenException('You cannot revoke this contact request');
        }
        if (request.status !== 'approved' && request.status !== 'pending') {
            throw new ConflictException('This contact request cannot be revoked');
        }
        const changed = await this.prisma.contactAccessRequest.updateMany({
            where: { id: requestId, status: request.status },
            data: { status: 'revoked', decidedAt: new Date() },
        });
        if (changed.count !== 1) throw new ConflictException('This contact request has already changed');
        const otherUserId = request.requesterId === userId ? request.recipientId : request.requesterId;
        await this.push.sendToUser(otherUserId, {
            title: 'Contact access updated',
            body: 'Contact access is no longer available.',
            data: { type: 'contact_access_request', requestId, status: 'revoked' },
        });
        return { id: requestId, status: 'revoked' as const };
    }

    async phone(requesterId: string, requestId: string) {
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT \`id\` FROM \`ContactAccessRequest\` WHERE \`id\` = ${requestId} FOR UPDATE
            `;
            if (locked.length === 0) throw new NotFoundException('Contact request not found');

            const request = await tx.contactAccessRequest.findUnique({
                where: { id: requestId },
                include: {
                    requester: { select: { id: true, isActive: true, status: true } },
                    recipient: {
                        select: {
                            id: true,
                            phone: true,
                            isPhoneVerified: true,
                            isActive: true,
                            status: true,
                            profileVisibility: true,
                        },
                    },
                },
            });
            if (!request) throw new NotFoundException('Contact request not found');
            if (request.requesterId !== requesterId) throw new ForbiddenException('You cannot access this contact');
            if (request.status !== 'approved') throw new ForbiddenException('Contact access has not been approved');
            if (
                !request.requester.isActive ||
                request.requester.status !== 'active' ||
                !request.recipient.isActive ||
                request.recipient.status !== 'active'
            ) {
                throw new ForbiddenException('Contact access is unavailable');
            }
            const block = await tx.block.findFirst({
                where: {
                    OR: [
                        { blockerId: requesterId, blockedId: request.recipientId },
                        { blockerId: request.recipientId, blockedId: requesterId },
                    ],
                },
                select: { id: true },
            });
            if (block) throw new ForbiddenException('Contact access is unavailable');

            if (request.recipient.profileVisibility !== 'everyone' && request.recipient.profileVisibility !== 'matchesOnly') {
                throw new ForbiddenException('Contact access is unavailable');
            }
            if (request.recipient.profileVisibility === 'matchesOnly') {
                const [a, b] = [requesterId, request.recipientId].sort();
                const match = await tx.match.findUnique({
                    where: { userAId_userBId: { userAId: a, userBId: b } },
                    select: { id: true },
                });
                if (!match) throw new ForbiddenException('Contact access is unavailable');
            }
            if (!request.recipient.isPhoneVerified || !request.recipient.phone) {
                throw new NotFoundException('No verified contact number is available');
            }

            // The number is returned only for this authorized call; previously copied numbers cannot be recalled.
            return { phone: request.recipient.phone };
        });
    }
}
