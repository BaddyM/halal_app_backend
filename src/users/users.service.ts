import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeletionRequestStatus, Prisma, SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import {
    UpdateProfileDto,
    SubmitOnboardingDto,
    DiscoverQueryDto,
    LikeProfileDto,
    SetWaliDto,
    UpdatePhotoDto,
    DeleteAccountDto,
    RequestAccountDeletionDto,
} from './dto';
import { basename, extname, join } from 'path';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { createHmac, timingSafeEqual } from 'crypto';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { getJwtSecret } from 'src/auth/jwt-secret';
import { WaliService } from 'src/wali/wali.service';

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 min

@Injectable()
export class UsersService implements OnModuleInit {
    // Simple in-memory TTL cache for matchesSummary to improve first-reply
    // latency. Keyed by userId. TTL in ms.
    private matchesSummaryCache = new Map<
        string,
        { expiresAt: number; value: { pendingCount: number; acceptedCount: number; pending: any[]; accepted: any[] } }
    >();
    private readonly matchesSummaryTtl = 5000; // 5s

    private readonly logger = new Logger(UsersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly push: PushService,
        private readonly realtime: RealtimeBus,
        private readonly wali: WaliService,
    ) {}

    async onModuleInit() {
        const legacyPrivatePhotos = await this.prisma.photo.findMany({
            where: { isPrivate: true, url: { contains: '/uploads/photos/users/' } },
            select: { id: true, url: true },
        });
        const privateDirectory = join(process.cwd(), 'uploads', 'private', 'photos', 'users');
        if (legacyPrivatePhotos.length > 0 && !existsSync(privateDirectory)) {
            mkdirSync(privateDirectory, { recursive: true });
        }
        for (const photo of legacyPrivatePhotos) {
            const filename = basename(photo.url);
            const oldPath = join(process.cwd(), 'uploads', 'photos', 'users', filename);
            const newPath = join(privateDirectory, filename);
            if (existsSync(oldPath) && !existsSync(newPath)) renameSync(oldPath, newPath);
            await this.prisma.photo.update({
                where: { id: photo.id },
                data: { url: `/private/photos/users/${filename}` },
            });
        }
    }

    private photoAccessSecret() {
        return getJwtSecret(this.config);
    }

    private signedPrivatePhotoUrl(photoId: string, viewerId: string, admin = false) {
        const payload = Buffer.from(JSON.stringify({
            photoId,
            viewerId,
            admin,
            expiresAt: Date.now() + 10 * 60 * 1000,
        })).toString('base64url');
        const signature = createHmac('sha256', this.photoAccessSecret()).update(payload).digest('base64url');
        return `/api/media/private-photos/${photoId}?token=${payload}.${signature}`;
    }

    async photoUrlForViewer(viewerId: string, photoId: string) {
        const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) throw new NotFoundException('Photo not found');
        if (photo.moderationStatus !== 'approved' && viewerId !== photo.userId) {
            throw new NotFoundException('Photo not found');
        }
        if (!photo.isPrivate) {
            if (viewerId !== photo.userId) {
                const match = await this.prisma.match.findFirst({
                    where: { OR: [{ userAId: viewerId, userBId: photo.userId }, { userAId: photo.userId, userBId: viewerId }] },
                    select: { id: true },
                });
                if (!match || (await this.blockedIdsFor(viewerId)).has(photo.userId)) {
                    throw new NotFoundException('Photo not found');
                }
            }
            if (photo.moderationStatus !== 'approved' && viewerId === photo.userId) {
                return { id: photo.id, url: this.signedPrivatePhotoUrl(photo.id, viewerId), isPrivate: false };
            }
            return { id: photo.id, url: this.toRelativeAssetPath(photo.url), isPrivate: false };
        }
        if ((await this.privateAccessFor(viewerId, photo.userId)) !== 'granted' ||
            (viewerId !== photo.userId && (await this.blockedIdsFor(viewerId)).has(photo.userId))) {
            throw new NotFoundException('Photo not found');
        }
        return { id: photo.id, url: this.signedPrivatePhotoUrl(photo.id, viewerId), isPrivate: true };
    }

    async getPublicPhotoFile(fileName: string) {
        if (!/^[A-Za-z0-9._-]+$/.test(fileName)) throw new NotFoundException('Photo not found');
        const url = `/uploads/photos/users/${fileName}`;
        const photo = await this.prisma.photo.findFirst({
            where: { url, moderationStatus: 'approved' },
            select: { id: true, url: true },
        });
        if (!photo) throw new NotFoundException('Photo not found');
        const filePath = join(process.cwd(), 'uploads', 'photos', 'users', fileName);
        if (!existsSync(filePath)) throw new NotFoundException('Photo not found');
        const ext = extname(filePath).toLowerCase();
        return {
            filePath,
            contentType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
        };
    }

    async getPrivatePhotoFile(photoId: string, token: string) {
        const [payload, signature] = token.split('.');
        if (!payload || !signature) throw new NotFoundException('Photo not found');
        const expected = createHmac('sha256', this.photoAccessSecret()).update(payload).digest();
        let supplied: Buffer;
        try { supplied = Buffer.from(signature, 'base64url'); } catch { throw new NotFoundException('Photo not found'); }
        if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
            throw new NotFoundException('Photo not found');
        }
        let claims: { photoId: string; viewerId: string; admin?: boolean; expiresAt: number };
        try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
        catch { throw new NotFoundException('Photo not found'); }
        if (claims.photoId !== photoId || claims.expiresAt <= Date.now()) throw new NotFoundException('Photo not found');

        const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) throw new NotFoundException('Photo not found');
        if (claims.admin) {
            const admin = await this.prisma.user.findUnique({ where: { id: claims.viewerId }, select: { role: true } });
            if (admin?.role !== 'admin') throw new NotFoundException('Photo not found');
        } else if (claims.viewerId !== photo.userId) {
            if (photo.moderationStatus !== 'approved') throw new NotFoundException('Photo not found');
            const blocked = await this.blockedIdsFor(claims.viewerId);
            if (blocked.has(photo.userId)) throw new NotFoundException('Photo not found');
            if (photo.isPrivate) {
                const grant = await this.prisma.photoAccessRequest.findUnique({
                    where: { requesterId_ownerId: { requesterId: claims.viewerId, ownerId: photo.userId } },
                });
                if (!grant || grant.status !== 'granted' ||
                    (grant.expiresAt && grant.expiresAt <= new Date())) {
                    throw new NotFoundException('Photo not found');
                }
            } else {
                const match = await this.prisma.match.findFirst({
                    where: { OR: [{ userAId: claims.viewerId, userBId: photo.userId }, { userAId: photo.userId, userBId: claims.viewerId }] },
                    select: { id: true },
                });
                if (!match) throw new NotFoundException('Photo not found');
            }
        }
        await this.prisma.photoAccessAudit.create({
            data: { requesterId: claims.viewerId, ownerId: photo.userId, photoId, action: 'view' },
        });
        const filePath = photo.url.startsWith('/private/')
            ? join(process.cwd(), 'uploads', photo.url.replace(/^\//, ''))
            : join(process.cwd(), photo.url.replace(/^\//, ''));
        if (!existsSync(filePath)) throw new NotFoundException('Photo not found');
        return { filePath, contentType: extname(filePath).toLowerCase() === '.png' ? 'image/png' : extname(filePath).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg' };
    }

    async exportData(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                photos: true,
                onboardingAnswers: true,
                likesGiven: true,
                likesReceived: true,
                matchesAsA: true,
                matchesAsB: true,
                inboxMessages: true,
                supportTickets: { include: { messages: true } },
                devices: true,
                transactions: true,
                subscription: true,
                tasbihSessions: true,
                tasbihDailyStats: true,
                tasbihStreaks: true,
                userBadges: true,
            },
        });
        if (!user) throw new NotFoundException('User not found');
        const { password, ...account } = user;
        return { exportedAt: new Date().toISOString(), account };
    }

    async deleteAccount(userId: string, dto: DeleteAccountDto) {
        if (!dto.confirm) throw new BadRequestException('Account deletion must be confirmed');
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
        if (!user) throw new NotFoundException('User not found');
        if (!(await bcrypt.compare(dto.password, user.password))) {
            throw new BadRequestException('Incorrect password');
        }
        await this.prisma.user.delete({ where: { id: userId } });
        this.matchesSummaryCache.delete(userId);
        return { success: true };
    }

    async requestAccountDeletion(userId: string, dto: RequestAccountDeletionDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { password: true, email: true, phone: true },
        });
        if (!user) throw new NotFoundException('User not found');
        if (!(await bcrypt.compare(dto.password, user.password))) {
            throw new BadRequestException('Incorrect password');
        }
        const existing = await this.prisma.accountDeletionRequest.findFirst({
            where: { userId, status: DeletionRequestStatus.pending },
        });
        const request = existing
            ? await this.prisma.accountDeletionRequest.update({
                  where: { id: existing.id },
                  data: { reason: dto.reason ?? null },
              })
            : await this.prisma.accountDeletionRequest.create({
                  data: {
                      userId,
                      email: user.email,
                      phone: user.phone,
                      reason: dto.reason ?? null,
                  },
              });
        this.realtime.emitAdminEvent('moderation', `${userId} requested account deletion`, { requestId: request.id });
        return { requestId: request.id, status: request.status, createdAt: request.requestedAt };
    }

    async listAccountDeletionRequests(status = 'pending') {
        const statusFilter = Object.values(DeletionRequestStatus).find(
            (value) => value === status,
        );
        if (status !== 'all' && !statusFilter) {
            throw new BadRequestException('Invalid deletion request status');
        }
        return this.prisma.accountDeletionRequest.findMany({
            where: statusFilter ? { status: statusFilter } : {},
            include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
            orderBy: { requestedAt: 'desc' },
        });
    }

    async reviewAccountDeletionRequest(requestId: string, adminId: string, approve: boolean) {
        const request = await this.prisma.accountDeletionRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Deletion request not found');
        if (request.status !== 'pending') throw new BadRequestException('Deletion request has already been reviewed');
        if (approve) {
            const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } });
            await this.prisma.$transaction(async (tx) => {
                if (request.userId) {
                    await tx.user.delete({ where: { id: request.userId } });
                }
                await tx.accountDeletionRequest.update({
                    where: { id: requestId },
                    data: {
                        status: DeletionRequestStatus.confirmed,
                        handledById: adminId,
                        handledAt: new Date(),
                        hardDeleted: true,
                    },
                });
                await tx.auditLog.create({
                    data: {
                        adminId,
                        adminEmail: admin?.email ?? null,
                        action: 'POST /admin/account-deletion-requests/:id/approve',
                        target: request.userId,
                    },
                });
            });
            return { requestId, status: 'approved' };
        }
        const updated = await this.prisma.accountDeletionRequest.update({
            where: { id: requestId },
            data: {
                status: DeletionRequestStatus.rejected,
                handledById: adminId,
                handledAt: new Date(),
            },
        });
        await this.prisma.auditLog.create({
            data: {
                adminId,
                action: 'POST /admin/account-deletion-requests/:id/reject',
                target: request.userId,
            },
        });
        return updated;
    }

    // ── helpers ─────────────────────────────────────────────────
    private calcAge(dob: Date | null | undefined): number | null {
        if (!dob) return null;
        const now = new Date();
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
        return age;
    }

    private isOnline(lastSeenAt: Date | null | undefined): boolean {
        if (!lastSeenAt) return false;
        return Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
    }

    /// Ids the viewer should never see: people they blocked AND people who
    /// blocked them. Hiding is bidirectional so a block can't be sidestepped.
    private async blockedIdsFor(userId: string): Promise<Set<string>> {
        const blocks = await this.prisma.block.findMany({
            where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
            select: { blockerId: true, blockedId: true },
        });
        const ids = new Set<string>();
        for (const b of blocks) {
            ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
        }
        return ids;
    }

    /// Collapse an absolute asset URL to its host-relative path so stored
    /// references survive an API host change. Relative paths and null pass
    /// through unchanged.
    private toRelativeAssetPath(url: string | null | undefined): string | null {
        if (!url) return url ?? null;
        if (/^https?:\/\//i.test(url)) {
            try {
                return new URL(url).pathname;
            } catch {
                return url;
            }
        }
        return url;
    }

    private publicSocialLinks(raw: unknown): Record<string, { url: string; isPublic: boolean }> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return Object.fromEntries(
            Object.entries(raw as Record<string, unknown>).filter(([, value]) => {
                return !!value && typeof value === 'object' && (value as any).isPublic === true && typeof (value as any).url === 'string';
            }),
        ) as Record<string, { url: string; isPublic: boolean }>;
    }

    private serializeProfile(
        user: any,
        viewer: { id: string; plan: SubscriptionPlan } | null,
        compatibilityScore = 0,
        matchReasons: string[] = [],
        // 'granted' unlocks the owner's private photos for this viewer.
        privateAccess: 'none' | 'pending' | 'granted' = 'none',
        options?: { mode?: 'summary' | 'full'; maxPhotos?: number },
    ) {
        const profile = user.profile;
        const allPhotos: Array<{ id: string; url: string; isPrimary?: boolean; isPrivate?: boolean; moderationStatus?: string }> =
            user.photos ?? [];
        const isSelf = viewer?.id === user.id;
        const canSeePrivate = isSelf || privateAccess === 'granted';
        const mode = options?.mode ?? 'full';
        const maxPhotos = Math.max(1, options?.maxPhotos ?? (mode === 'summary' ? 3 : 10));

        const approvedPhotos = allPhotos.filter((p) => p.moderationStatus === 'approved');
        const publicPhotos = approvedPhotos.filter((p) => !p.isPrivate);
        const privatePhotos = approvedPhotos.filter((p) => p.isPrivate);

        // Detailed photo list. The owner sees everything (with privacy flags);
        // a viewer sees public photos plus, only if granted, the private ones.
        const visiblePhotos = isSelf ? allPhotos : canSeePrivate ? approvedPhotos : publicPhotos;
        const visibleSlice = visiblePhotos.slice(0, maxPhotos);
        const photoUrl = (photo: typeof visibleSlice[number]) =>
            (photo.isPrivate || (isSelf && photo.moderationStatus !== 'approved')) && viewer
                ? this.signedPrivatePhotoUrl(photo.id, viewer.id)
                : this.toRelativeAssetPath(photo.url);
        const photos = visibleSlice.map((p) => ({
            id: p.id,
            url: photoUrl(p),
            isPrimary: p.isPrimary ?? false,
            isPrivate: p.isPrivate ?? false,
        }));
        const galleryImages = visibleSlice.map(photoUrl);
        const selfPrimaryPhoto = allPhotos.find((p) => p.url === profile?.primaryImageUrl) ??
            allPhotos.find((p) => p.isPrimary && !p.isPrivate) ??
            publicPhotos[0];
        const primaryImage = isSelf
            ? selfPrimaryPhoto && (selfPrimaryPhoto.isPrivate || selfPrimaryPhoto.moderationStatus !== 'approved') && viewer
                ? this.signedPrivatePhotoUrl(selfPrimaryPhoto.id, viewer.id)
                : this.toRelativeAssetPath(profile?.primaryImageUrl ?? selfPrimaryPhoto?.url ?? null)
            : this.toRelativeAssetPath(publicPhotos.find((p) => p.isPrimary)?.url ?? publicPhotos[0]?.url ?? null);

        const basePayload = {
            id: user.id,
            name: user.name,
            age: this.calcAge(profile?.dateOfBirth),
            city: profile?.city,
            country: profile?.country,
            location: [profile?.city, profile?.country].filter(Boolean).join(', '),
            profession: profile?.profession,
            bio: profile?.bio,
            imageUrl: primaryImage,
            galleryImages,
            photos,
            privatePhotoCount: privatePhotos.length,
            privatePhotoAccess: isSelf ? 'owner' : privateAccess,
            isVerified: profile?.isVerified ?? false,
            isOnline: isSelf || (user.incognitoMode !== true && user.showOnlineStatus !== false && this.isOnline(user.lastSeenAt)),
            lastSeenAt: isSelf || (user.incognitoMode !== true && user.showLastSeen === true) ? user.lastSeenAt : undefined,
            compatibilityScore,
            matchReasons,
            socialLinks: isSelf
                ? profile?.socialLinks ?? {}
                : this.publicSocialLinks(profile?.socialLinks),
            origin: this.answerText(
                (user.onboardingAnswers ?? []).find((a: any) => a.questionId === 'cultural_background')?.answer,
            ) || profile?.ethnicity,
            tribe: this.answerText(
                (user.onboardingAnswers ?? []).find((a: any) => a.questionId === 'ugandan_tribe')?.answer,
            ),
        };

        if (mode === 'summary') {
            return basePayload;
        }

        return {
            ...basePayload,
            profileViews: user.profileViews ?? 0,
            onboardingAnswers: Object.fromEntries(
                (user.onboardingAnswers ?? []).map((answer: any) => [
                    answer.questionId,
                    answer.answer,
                ]),
            ),
            hasBeard: profile?.hasBeard,
            prefersBeard: profile?.prefersBeard,
            prefersHijab: profile?.prefersHijab,
            phone: isSelf ? user.phone : undefined,
            email: isSelf ? user.email : undefined,
            gender: profile?.gender,
            prayerFrequency: profile?.prayerFrequency,
            sect: profile?.sect,
            wearsHijab:
                profile?.hijabPreference === 'hijab' ||
                profile?.hijabPreference === 'niqab',
            hijabPreference: profile?.hijabPreference,
            ethnicity: profile?.ethnicity,
            maritalTimeline: profile?.maritalTimeline,
            childrenPref: profile?.childrenPref,
            locationPref: profile?.locationPref,
            values: profile?.values ?? [],
            interests: profile?.interests ?? [],
            completeness: profile?.completeness ?? 0,
            // Self-only fields
            plan: isSelf ? user.plan : undefined,
            isEmailVerified: isSelf ? user.isEmailVerified : undefined,
            isPhoneVerified: isSelf ? user.isPhoneVerified : undefined,
            likesUsedToday: isSelf ? user.likesUsedToday : undefined,
            activeChatsCount: isSelf ? user.activeChatsCount : undefined,
            onboardingCompleted: isSelf ? user.onboardingCompleted : undefined,
            prayerTimesEnabled: isSelf ? user.prayerTimesEnabled : undefined,
            readReceiptsEnabled: isSelf ? user.readReceiptsEnabled : undefined,
            showOnlineStatus: isSelf ? user.showOnlineStatus : undefined,
            showLastSeen: isSelf ? user.showLastSeen : undefined,
            showDistance: isSelf ? user.showDistance : undefined,
            incognitoMode: isSelf ? user.incognitoMode : undefined,
            profileVisibility: isSelf ? user.profileVisibility : undefined,
            halalVerificationSubmitted: isSelf ? user.halalVerificationSubmitted : undefined,
            wali: isSelf && profile?.waliName
                ? {
                      name: profile.waliName,
                      email: profile.waliEmail ?? null,
                      phone: profile.waliPhone ?? null,
                      relation: profile.waliRelation ?? null,
                  }
                : undefined,
        };
    }

    // ── completeness ────────────────────────────────────────────
    /// Weighted profile-completeness fields. Each present field contributes
    /// its weight; the meter is the % of total weight filled in.
    private completenessFields(user: any): Array<{ key: string; label: string; weight: number; done: boolean }> {
        const p = user.profile ?? {};
        const photoCount = (user.photos ?? []).length;
        return [
            { key: 'gender', label: 'Gender', weight: 1, done: !!p.gender },
            { key: 'dateOfBirth', label: 'Age', weight: 1, done: !!p.dateOfBirth },
            { key: 'location', label: 'Location', weight: 1, done: !!(p.city || p.country) },
            { key: 'profession', label: 'Profession', weight: 1, done: !!p.profession },
            { key: 'bio', label: 'About you', weight: 1, done: !!(p.bio && String(p.bio).length >= 20) },
            { key: 'photo', label: 'A photo', weight: 2, done: photoCount > 0 || !!p.primaryImageUrl },
            { key: 'prayerFrequency', label: 'Prayer practice', weight: 1, done: !!p.prayerFrequency },
            { key: 'sect', label: 'Madhab / sect', weight: 1, done: !!p.sect },
            { key: 'ethnicity', label: 'Cultural background', weight: 1, done: !!p.ethnicity },
            // For completeness: if gender is female, hijab matters; if male, beard presence is asked.
            { key: 'hijabPreference', label: 'Hijab/appearance', weight: 1, done: !!(p.gender === 'female' ? p.hijabPreference : p.hasBeard) },
            { key: 'maritalTimeline', label: 'Marriage timeline', weight: 1, done: !!p.maritalTimeline },
            { key: 'childrenPref', label: 'Children preference', weight: 1, done: !!p.childrenPref },
            { key: 'interests', label: 'Interests', weight: 1, done: Array.isArray(p.interests) && p.interests.length > 0 },
            { key: 'phone', label: 'Verified phone', weight: 1, done: !!user.isPhoneVerified },
        ];
    }

    private computeCompleteness(user: any): number {
        const fields = this.completenessFields(user);
        const total = fields.reduce((s, f) => s + f.weight, 0);
        const got = fields.filter((f) => f.done).reduce((s, f) => s + f.weight, 0);
        return total === 0 ? 0 : Math.round((got / total) * 100);
    }

    async getCompleteness(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true, photos: true },
        });
        if (!user) throw new NotFoundException('User not found');
        const fields = this.completenessFields(user);
        const completeness = this.computeCompleteness(user);
        // Keep the stored value in sync so dashboard analytics stay accurate.
        if (user.profile && user.profile.completeness !== completeness) {
            await this.prisma.profile.update({
                where: { userId },
                data: { completeness },
            });
        }
        return {
            completeness,
            missing: fields.filter((f) => !f.done).map((f) => ({ key: f.key, label: f.label })),
            fields: fields.map((f) => ({ key: f.key, label: f.label, done: f.done })),
        };
    }

    private prayerLabel(p: string): string {
        switch (p) {
            case 'fiveTimes': return '5 daily prayers';
            case 'mostPrayers': return 'most prayers';
            case 'jumuahOnly': return "Jumu'ah";
            default: return p;
        }
    }

    private timelineLabel(t: string): string {
        switch (t) {
            case 'asap': return 'as soon as possible';
            case 'withinYear': return 'within a year';
            case 'oneToTwoYears': return 'in 1-2 years';
            case 'openTimeline': return 'open timeline';
            default: return t;
        }
    }

    private childrenLabel(c: string): string {
        switch (c) {
            case 'noWantThem': return 'wanting children';
            case 'noOpenToIt': return 'open to children';
            case 'haveWantMore': return 'wanting more children';
            case 'haveNoMore': return 'no more children';
            default: return c;
        }
    }

    // Marriage-timeline distance: same=1.0, neighbour=0.6, gap-2=0.3, far=0.
    private timelineSimilarity(a: string, b: string): number {
        const order = ['asap', 'withinYear', 'oneToTwoYears', 'openTimeline'];
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia < 0 || ib < 0) return 0;
        const gap = Math.abs(ia - ib);
        return [1.0, 0.6, 0.3, 0][gap] ?? 0;
    }

    // Hard children-preference clash: one wants kids, the other firmly doesn't.
    private childrenClash(a: string, b: string): boolean {
        const wantsKids = (p: string) => p === 'noWantThem' || p === 'haveWantMore';
        const refusesKids = (p: string) => p === 'haveNoMore';
        return (wantsKids(a) && refusesKids(b)) || (wantsKids(b) && refusesKids(a));
    }

    private onboardingMap(user: any): Record<string, any> {
        const answers = Array.isArray(user?.onboardingAnswers) ? user.onboardingAnswers : [];
        const map: Record<string, any> = {};
        for (const item of answers) {
            const key = String(item?.questionId ?? '').trim();
            if (!key) continue;
            map[key] = item.answer;
        }
        return map;
    }

    private answerText(answer: any): string {
        if (answer == null) return '';
        if (Array.isArray(answer)) return answer.map((part) => String(part)).join(', ');
        if (typeof answer === 'string') return answer.trim();
        return String(answer).trim();
    }

    private matchesGroupedChoice(viewer: any, candidate: any, keys: string[]): boolean {
        const viewerMap = this.onboardingMap(viewer);
        const candidateMap = this.onboardingMap(candidate);
        const viewerValues = keys
            .map((key) => this.answerText(viewerMap[key]))
            .filter(Boolean);
        const candidateValues = keys
            .map((key) => this.answerText(candidateMap[key]))
            .filter(Boolean);
        if (viewerValues.length === 0 || candidateValues.length === 0) return false;
        return viewerValues.some((value) => candidateValues.includes(value));
    }

    private compatibilityDetails(
        viewer: any,
        candidate: any,
    ): { score: number; reasons: string[] } {
        if (!viewer?.profile || !candidate?.profile) {
            return { score: 0.5, reasons: [] };
        }

        const v = viewer.profile;
        const c = candidate.profile;
        const viewerAnswers = this.onboardingMap(viewer);
        const candidateAnswers = this.onboardingMap(candidate);

        let score = 0;
        let weight = 0;
        let penalty = 0;
        const reasons: string[] = [];

        const add = (got: boolean, w: number) => {
            weight += w;
            if (got) score += w;
        };

        // ── Faith cluster ─────────────────────────────────────────
        if (v.prayerFrequency && v.prayerFrequency === c.prayerFrequency) {
            add(true, 3);
            reasons.push(`Both pray ${this.prayerLabel(v.prayerFrequency)}`);
        } else {
            add(false, 3);
        }

        if (v.sect && v.sect === c.sect) {
            add(true, 2);
            reasons.push(`Both ${v.sect.charAt(0).toUpperCase()}${v.sect.slice(1)}`);
        } else {
            add(false, 2);
        }

        const professionA = this.answerText(viewerAnswers.profession || v.profession);
        const professionB = this.answerText(candidateAnswers.profession || c.profession);
        if (professionA && professionB && professionA === professionB) {
            add(true, 1.5);
            reasons.push(`Both in ${professionA}`);
        } else {
            add(false, 1.5);
        }

        const culturalBackgroundA = this.answerText(viewerAnswers.cultural_background || v.ethnicity);
        const culturalBackgroundB = this.answerText(candidateAnswers.cultural_background || c.ethnicity);
        if (culturalBackgroundA && culturalBackgroundB && culturalBackgroundA === culturalBackgroundB) {
            add(true, 1);
            reasons.push(`Shared cultural background: ${culturalBackgroundA}`);
        } else {
            add(false, 1);
        }

        if (this.matchesGroupedChoice(viewer, candidate, ['family_involvement', 'family_role'])) {
            add(true, 1);
            reasons.push('Similar family involvement preferences');
        } else {
            add(false, 1);
        }

        if (this.matchesGroupedChoice(viewer, candidate, ['cultural_compatibility', 'cultural_fit'])) {
            add(true, 1);
            reasons.push('Aligned on cultural compatibility');
        } else {
            add(false, 1);
        }

        if (this.matchesGroupedChoice(viewer, candidate, ['intercultural_marriage', 'intercultural'])) {
            add(true, 1);
            reasons.push('Open to compatible intercultural match');
        } else {
            add(false, 1);
        }

        const sharedChildrenValues = this.matchesGroupedChoice(viewer, candidate, ['children_values', 'childrenValues']);
        if (sharedChildrenValues) {
            add(true, 1);
            reasons.push('Similar goals for future children');
        } else {
            add(false, 1);
        }

        if (v.hijabPreference && v.hijabPreference === c.hijabPreference) {
            add(true, 1);
        } else {
            add(false, 1);
        }

        // Partner appearance preferences: beard and hijab
        if (v.prefersBeard !== undefined) {
            add(v.prefersBeard === !!c.hasBeard, 1);
            if (v.prefersBeard && c.hasBeard) reasons.push('Prefers bearded partners');
        }
        if (v.prefersHijab !== undefined) {
            const candidateWearsHijab = c.hijabPreference === 'hijab' || c.hijabPreference === 'niqab';
            add(v.prefersHijab === candidateWearsHijab, 1);
            if (v.prefersHijab && candidateWearsHijab) reasons.push('Prefers partners who wear hijab');
        }

        // ── Marriage timeline ─────────────────────────────────────
        if (v.maritalTimeline && c.maritalTimeline) {
            const sim = this.timelineSimilarity(v.maritalTimeline, c.maritalTimeline);
            weight += 2;
            score += sim * 2;
            if (sim === 1.0) {
                reasons.push(`Both seeking marriage ${this.timelineLabel(v.maritalTimeline)}`);
            } else if (sim >= 0.6) {
                reasons.push('Compatible marriage timelines');
            }
        }

        // ── Children preference ───────────────────────────────────
        if (v.childrenPref && c.childrenPref) {
            weight += 3;
            if (this.childrenClash(v.childrenPref, c.childrenPref)) {
                penalty += 0.2;
                reasons.push('⚠ Different views on children');
            } else if (v.childrenPref === c.childrenPref) {
                score += 3;
                reasons.push(`Both ${this.childrenLabel(v.childrenPref)}`);
            } else {
                score += 1.5;
            }
        }

        // ── Location ──────────────────────────────────────────────
        if (v.country && c.country) {
            weight += 2;
            if (v.country === c.country) {
                score += 2;
                if (v.city && c.city && v.city === c.city) {
                    weight += 1;
                    score += 1;
                    reasons.push(`Both in ${v.city}`);
                } else {
                    reasons.push(`Both in ${v.country}`);
                }
            }
        }

        // ── Ethnicity ─────────────────────────────────────────────
        if (v.ethnicity && v.ethnicity === c.ethnicity) {
            add(true, 1);
            reasons.push(`Both ${v.ethnicity}`);
        } else {
            add(false, 1);
        }

        // ── Shared values ─────────────────────────────────────────
        const vv = (v.values ?? []) as string[];
        const cv = (c.values ?? []) as string[];
        if (vv.length > 0 && cv.length > 0) {
            const sharedValues = vv.filter((x) => cv.includes(x));
            weight += 2;
            score += (sharedValues.length / Math.max(vv.length, cv.length)) * 2;
            if (sharedValues.length > 0) {
                reasons.push(`Share values: ${sharedValues.slice(0, 2).join(', ')}`);
            }
        }

        // ── Shared interests ──────────────────────────────────────
        const vi = (v.interests ?? []) as string[];
        const ci = (c.interests ?? []) as string[];
        if (vi.length > 0 && ci.length > 0) {
            const sharedInterests = vi.filter((x) => ci.includes(x));
            weight += 1;
            score += (sharedInterests.length / Math.max(vi.length, ci.length)) * 1;
            if (sharedInterests.length > 0) {
                reasons.push(`Common interests: ${sharedInterests.slice(0, 2).join(', ')}`);
            }
        }

        // ── Age gap penalty ───────────────────────────────────────
        const va = this.calcAge(v.dateOfBirth);
        const ca = this.calcAge(c.dateOfBirth);
        if (va && ca) {
            const gap = Math.abs(va - ca);
            if (gap > 10) {
                penalty += 0.05 * Math.floor((gap - 10) / 5 + 1);
                reasons.push(`⚠ ${gap}-year age gap`);
            }
        }

        if (weight === 0) return { score: 0.5, reasons };

        const normalized = score / weight;
        const final = Math.max(0.1, Math.min(1, 0.5 + normalized * 0.5 - penalty));
        return { score: final, reasons };
    }

    private compatibility(viewer: any, candidate: any): number {
        return this.compatibilityDetails(viewer, candidate).score;
    }

    // ── current user ────────────────────────────────────────────
    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                onboardingAnswers: true,
                photos: { orderBy: { position: 'asc' } },
            },
        });
        if (!user) throw new NotFoundException('User not found');
        await this.touchLastSeen(userId);
        const serialized = this.serializeProfile(user, { id: userId, plan: user.plan });
        const waliFeature = await this.wali.getMemberFeatureState(userId);
        return {
            ...serialized,
            waliEnabled: user.profile?.waliEnabled !== false,
            waliFeatureEnabled: waliFeature.enabled,
        };
    }

    async getVerification(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true, identityVerification: true, photoVerification: true },
        });
        if (!user) throw new NotFoundException('User not found');
        const waliFeature = await this.wali.getMemberFeatureState(userId);
        return {
            phone: {
                number: user.phone,
                status: user.phoneVerificationStatus,
                reason: user.phoneVerificationReason,
            },
            wali: waliFeature.enabled && user.profile?.waliPhone
                ? { number: user.profile.waliPhone, status: 'notSubmitted', reason: null }
                : null,
            identity: user.identityVerification
                ? {
                      status: user.identityVerification.status,
                      reason: user.identityVerification.reason,
                      submission: user.identityVerification.submission,
                      submittedAt: user.identityVerification.createdAt,
                      reviewedAt: user.identityVerification.reviewedAt,
                  }
                : { status: 'notSubmitted', reason: null, submission: null },
            photo: user.photoVerification
                ? { status: user.photoVerification.status, reason: user.photoVerification.reason, submittedAt: user.photoVerification.createdAt }
                : { status: 'notSubmitted', reason: null },
            badge: { verified: user.profile?.isVerified === true },
        };
    }

    async submitPhoneForVerification(userId: string, phone: string) {
        const normalized = this.normalizePhone(phone);
        if (!normalized) throw new BadRequestException('Phone number is required');
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                phone: normalized,
                isPhoneVerified: false,
                phoneVerificationStatus: 'pending',
                phoneVerificationReason: null,
            },
        });
        this.realtime.emitToUser(userId, 'verification:updated', { kind: 'phone', status: 'pending' });
        return {
            number: updated.phone,
            status: updated.phoneVerificationStatus,
            reason: updated.phoneVerificationReason,
        };
    }

    async submitIdentityVerification(userId: string, submission: Record<string, unknown>) {
        const documentType = submission?.documentType;
        const documents = submission?.documents;
        if (documentType !== 'nationalId' && documentType !== 'passport') {
            throw new BadRequestException('Choose national ID or passport');
        }
        if (!documents || typeof documents !== 'object' || Array.isArray(documents)) {
            throw new BadRequestException('Verification documents are required');
        }
        const requiredKinds = ['front', 'back', 'holdingProof'];
        for (const kind of requiredKinds) {
            const item = (documents as any)[kind];
            if (!item?.documentId || item.kind !== kind) {
                throw new BadRequestException(`Missing verification document: ${kind}`);
            }
        }
        const verification = await this.prisma.identityVerification.upsert({
            where: { userId },
            update: {
                submission: submission as any,
                status: 'pending',
                reason: null,
                reviewedAt: null,
            },
            create: { userId, submission: submission as any, status: 'pending' },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { halalVerificationSubmitted: true },
        });
        this.realtime.emitToUser(userId, 'verification:updated', { kind: 'identity', status: 'pending' });
        return {
            status: verification.status,
            reason: verification.reason,
            submittedAt: verification.createdAt,
        };
    }

    async touchLastSeen(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastSeenAt: new Date() },
        });
    }

    // ── profile ────────────────────────────────────────────────
    async updateProfile(userId: string, dto: UpdateProfileDto) {
        if (dto.readReceiptsEnabled === true) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { plan: true },
            });
            if (!user || user.plan === 'basic') {
                throw new ForbiddenException('Read receipts are a Premium feature.');
            }
        }
        // Load current profile gender to enforce gender-specific fields
        const cur = await this.prisma.profile.findUnique({ where: { userId }, select: { gender: true } });
        if (dto.name !== undefined) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { name: dto.name },
            });
        }

        if (dto.phone !== undefined) {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    phone: this.normalizePhone(dto.phone),
                    isPhoneVerified: false,
                    phoneVerificationStatus: 'pending',
                    phoneVerificationReason: null,
                },
            });
        }

        if (
            dto.prayerTimesEnabled !== undefined ||
            dto.halalVerificationSubmitted !== undefined ||
            dto.readReceiptsEnabled !== undefined ||
            dto.showOnlineStatus !== undefined ||
            dto.showLastSeen !== undefined ||
            dto.showDistance !== undefined ||
            dto.incognitoMode !== undefined ||
            dto.profileVisibility !== undefined
        ) {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    ...(dto.prayerTimesEnabled !== undefined && {
                        prayerTimesEnabled: dto.prayerTimesEnabled,
                    }),
                    ...(dto.halalVerificationSubmitted !== undefined && {
                        halalVerificationSubmitted: dto.halalVerificationSubmitted,
                    }),
                    ...(dto.readReceiptsEnabled !== undefined && {
                        readReceiptsEnabled: dto.readReceiptsEnabled,
                    }),
                    ...(dto.showOnlineStatus !== undefined && { showOnlineStatus: dto.showOnlineStatus }),
                    ...(dto.showLastSeen !== undefined && { showLastSeen: dto.showLastSeen }),
                    ...(dto.showDistance !== undefined && { showDistance: dto.showDistance }),
                    ...(dto.incognitoMode !== undefined && { incognitoMode: dto.incognitoMode }),
                    ...(dto.profileVisibility !== undefined && { profileVisibility: dto.profileVisibility }),
                },
            });
        }

        const data: Prisma.ProfileUpdateInput = {
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.dateOfBirth !== undefined && {
                dateOfBirth: new Date(dto.dateOfBirth),
            }),
            ...(dto.city !== undefined && { city: dto.city }),
            ...(dto.country !== undefined && { country: dto.country }),
            ...(dto.profession !== undefined && { profession: dto.profession }),
            ...(dto.bio !== undefined && { bio: dto.bio }),
            ...(dto.primaryImageUrl !== undefined && {
                // Store a host-relative path. Clients sometimes echo back an
                // absolute URL (e.g. http://<lan-ip>:3001/uploads/...) which
                // breaks when the API host changes; collapse it to the path.
                primaryImageUrl: this.toRelativeAssetPath(dto.primaryImageUrl),
            }),
            ...(dto.prayerFrequency !== undefined && {
                prayerFrequency: dto.prayerFrequency,
            }),
            ...(dto.sect !== undefined && { sect: dto.sect }),
            // Only allow hijabPreference when the profile is female (either
            // the incoming DTO sets gender=female, or the existing profile is female).
            ...(
                dto.hijabPreference !== undefined &&
                (dto.gender === 'female' || (dto.gender === undefined && cur?.gender === 'female'))
                    ? { hijabPreference: dto.hijabPreference }
                    : {}
            ),
            ...(dto.ethnicity !== undefined && { ethnicity: dto.ethnicity }),
            ...(dto.maritalTimeline !== undefined && {
                maritalTimeline: dto.maritalTimeline,
            }),
            ...(dto.childrenPref !== undefined && {
                childrenPref: dto.childrenPref,
            }),
            ...(dto.locationPref !== undefined && {
                locationPref: dto.locationPref,
            }),
            ...(dto.values !== undefined && { values: dto.values as any }),
            ...(dto.interests !== undefined && { interests: dto.interests as any }),
            ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks as any }),
        };

        await this.prisma.profile.upsert({
            where: { userId },
            update: data,
            create: { userId, ...(data as any) },
        });

        await this.refreshIsComplete(userId);
        return this.getMe(userId);
    }

    private normalizePhone(raw: string): string {
        const value = raw.trim().replace(/[\s().-]/g, '');
        if (!/^\+[1-9]\d{7,14}$/.test(value)) {
            throw new BadRequestException('Phone number must use international format, for example +256757919472');
        }
        return value;
    }

    /// A profile is "complete enough" to appear in discover once gender is
    /// set. Other fields can be filled in over time. Without this lower bar
    /// new users who just finished onboarding would never show up in anyone's
    /// deck (and could never be liked → could never match).
    private async refreshIsComplete(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true, photos: true },
        });
        if (!user?.profile) return;
        const complete = !!user.profile.gender;
        const completeness = this.computeCompleteness(user);
        if (
            complete !== user.profile.isComplete ||
            completeness !== user.profile.completeness
        ) {
            await this.prisma.profile.update({
                where: { userId },
                data: { isComplete: complete, completeness },
            });
        }
    }

    /// Onboarding gives us an age *range* like "25–29". Pick a date in the
    /// middle of that range so the user has an age for filtering & display.
    private dobFromAgeRange(label: string): Date | null {
        const match = label.match(/(\d{2})\s*[–-]\s*(\d{2})/);
        let mid: number | null = null;
        if (match) {
            mid = Math.round((parseInt(match[1], 10) + parseInt(match[2], 10)) / 2);
        } else if (label.trim().startsWith('50')) {
            mid = 55;
        }
        if (mid == null || mid < 18 || mid > 100) return null;
        const now = new Date();
        return new Date(now.getFullYear() - mid, 0, 1);
    }

    // ── onboarding ─────────────────────────────────────────────
    async submitOnboarding(userId: string, dto: SubmitOnboardingDto) {
        if (!dto.answers?.length) throw new BadRequestException('No answers');

        const answersById = new Map(dto.answers.map((answer) => [answer.questionId, answer.answer]));
        const requiredQuestionIds = [
            'gender',
            'profession',
            'age_range',
            'prayer',
            'sect',
            'marriage_timeline',
            'cultural_background',
            'children',
            'values',
            'family_involvement',
            'cultural_compatibility',
            'intercultural_marriage',
            'children_values',
            'location_pref',
        ];
        const hasAnswer = (questionId: string) => {
            const answer = answersById.get(questionId);
            return Array.isArray(answer)
                ? answer.length > 0
                : typeof answer === 'string' && answer.trim().length > 0;
        };
        if (requiredQuestionIds.some((questionId) => !hasAnswer(questionId))) {
            throw new BadRequestException('Onboarding is incomplete');
        }
        const genderAnswer = String(answersById.get('gender')).toLowerCase();
        if (
            !genderAnswer.startsWith('brother') &&
            !genderAnswer.startsWith('sister')
        ) {
            throw new BadRequestException('Onboarding is incomplete');
        }
        if (
            (genderAnswer.startsWith('sister') && !hasAnswer('hijab')) ||
            (genderAnswer.startsWith('brother') && !hasAnswer('beard'))
        ) {
            throw new BadRequestException('Onboarding is incomplete');
        }
        if (
            String(answersById.get('cultural_background')).toLowerCase() === 'ugandan' &&
            !hasAnswer('ugandan_tribe')
        ) {
            throw new BadRequestException('Onboarding is incomplete');
        }

        await this.prisma.$transaction(
            dto.answers.map((a) =>
                this.prisma.onboardingAnswer.upsert({
                    where: {
                        userId_questionId: { userId, questionId: a.questionId },
                    },
                    update: { answer: a.answer as any },
                    create: { userId, questionId: a.questionId, answer: a.answer as any },
                }),
            ),
        );

        // Map onboarding answers → profile fields where possible
        const map = new Map(dto.answers.map((a) => [a.questionId, a.answer]));
        const profileUpdate: Prisma.ProfileUpdateInput = {};

        const gender = map.get('gender');
        if (typeof gender === 'string') {
            if (gender.toLowerCase().startsWith('brother')) profileUpdate.gender = 'male';
            else if (gender.toLowerCase().startsWith('sister')) profileUpdate.gender = 'female';
        }

        const prayer = map.get('prayer');
        if (typeof prayer === 'string') {
            const p = prayer.toLowerCase();
            if (p.startsWith('five') || p.startsWith('5')) profileUpdate.prayerFrequency = 'fiveTimes';
            else if (p.startsWith('most')) profileUpdate.prayerFrequency = 'mostPrayers';
            else if (p.startsWith("jumu")) profileUpdate.prayerFrequency = 'jumuahOnly';
            else profileUpdate.prayerFrequency = 'workingOnIt';
        }

        const sect = map.get('sect');
        if (typeof sect === 'string') {
            const s = sect.toLowerCase();
            if (s.startsWith('sunni')) profileUpdate.sect = 'sunni';
            else if (s.startsWith('shia')) profileUpdate.sect = 'shia';
            else if (s.startsWith('sufi')) profileUpdate.sect = 'sufi';
            else profileUpdate.sect = 'preferNotToSay';
        }

        const hijab = map.get('hijab');
        if (typeof hijab === 'string') {
            const h = hijab.toLowerCase();
            if (h.includes('niqab')) profileUpdate.hijabPreference = 'niqab';
            else if (h.includes('hijab')) profileUpdate.hijabPreference = 'hijab';
            else if (h.includes('not a sister')) profileUpdate.hijabPreference = 'notApplicable';
            else profileUpdate.hijabPreference = 'preferNotToSay';
        }

        // Beard presence for brothers and partner beard preference
        const beard = map.get('beard');
        if (typeof beard === 'string') {
            const b = beard.toLowerCase();
            if (b.includes('yes') || b.includes('have') || b.includes('beard')) profileUpdate.hasBeard = true;
            else if (b.includes('no') || b.includes('clean')) profileUpdate.hasBeard = false;
        }

        const prefersBeard = map.get('prefers_beard') || map.get('prefersBeard');
        if (typeof prefersBeard === 'string') {
            const pb = prefersBeard.toLowerCase();
            if (pb.includes('yes') || pb.includes('prefer')) profileUpdate.prefersBeard = true;
            else if (pb.includes('no') || pb.includes('not')) profileUpdate.prefersBeard = false;
        }

        const timeline = map.get('marriage_timeline');
        if (typeof timeline === 'string') {
            const t = timeline.toLowerCase();
            if (t.includes('soon')) profileUpdate.maritalTimeline = 'asap';
            else if (t.includes('within 1 year')) profileUpdate.maritalTimeline = 'withinYear';
            else if (t.includes('within 6 months')) profileUpdate.maritalTimeline = 'asap';
            else if (t.includes('1–2') || t.includes('1-2')) profileUpdate.maritalTimeline = 'oneToTwoYears';
            else profileUpdate.maritalTimeline = 'openTimeline';
        }

        const ethnicity = map.get('ethnicity');
        const culturalBackground = map.get('cultural_background');
        if (typeof culturalBackground === 'string') {
            profileUpdate.ethnicity = culturalBackground;
        } else if (typeof ethnicity === 'string') {
            profileUpdate.ethnicity = ethnicity;
        }

        const profession = map.get('profession');
        if (typeof profession === 'string') profileUpdate.profession = profession;

        const children = map.get('children');
        if (typeof children === 'string') {
            const c = children.toLowerCase();
            if (c.startsWith('no children, want')) profileUpdate.childrenPref = 'noWantThem';
            else if (c.startsWith('no children, open')) profileUpdate.childrenPref = 'noOpenToIt';
            else if (c.startsWith('have children, want')) profileUpdate.childrenPref = 'haveWantMore';
            else if (c.startsWith('have children, no')) profileUpdate.childrenPref = 'haveNoMore';
            else profileUpdate.childrenPref = 'preferNotToSay';
        }

        const values = map.get('values');
        if (Array.isArray(values)) profileUpdate.values = values as any;

        const locationPref = map.get('location_pref');
        if (typeof locationPref === 'string') {
            const l = locationPref.toLowerCase();
            if (l.startsWith('same city')) profileUpdate.locationPref = 'sameCity';
            else if (l.startsWith('same country')) profileUpdate.locationPref = 'sameCountry';
            else if (l.startsWith('anywhere')) profileUpdate.locationPref = 'anywhere';
            else profileUpdate.locationPref = 'countryOrAbroad';
        }

        // Synthesise a DOB from the age range so the user has a usable age
        // for filtering & display without us having to ask for the exact
        // date in onboarding.
        const ageRange = map.get('age_range');
        if (typeof ageRange === 'string') {
            const dob = this.dobFromAgeRange(ageRange);
            if (dob) profileUpdate.dateOfBirth = dob;
        }

        if (Object.keys(profileUpdate).length > 0) {
            // Ensure gender-specific fields aren't set for the opposite gender
            if (profileUpdate.gender === 'male') {
                delete (profileUpdate as any).hijabPreference;
            }
            if (profileUpdate.gender === 'female') {
                delete (profileUpdate as any).hasBeard;
            }

            await this.prisma.profile.upsert({
                where: { userId },
                update: profileUpdate,
                create: { userId, ...(profileUpdate as any) },
            });
            await this.refreshIsComplete(userId);
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { onboardingCompleted: true },
        });

        // Dev affordance: in MODE=Dev, give every newly-onboarded user
        // a few "they liked you first" rows so the match flow is
        // immediately testable. Skipped silently in production.
        if (this.config.get('MODE') === 'Dev') {
            await this.seedDevIncomingLikes(userId);
        }

        return this.getMe(userId);
    }

    /// Dev-only: when a user finishes onboarding, fabricate a couple of
    /// opposite-gender "incoming likes" so their first right-swipe forms a
    /// match (and they get to test the celebrate-and-chat flow). Idempotent.
    private async seedDevIncomingLikes(userId: string) {
        const me = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!me?.profile?.gender) return;

        // Anyone already in a like/match relationship with me? Skip.
        const existing = await this.prisma.like.count({
            where: { toUserId: userId },
        });
        if (existing > 0) return;

        const opposite = me.profile.gender === 'male' ? 'female' : 'male';
        const candidates = await this.prisma.user.findMany({
            where: {
                id: { not: userId },
                isActive: true,
                profile: { is: { isComplete: true, gender: opposite } },
            },
            take: 2,
            orderBy: { createdAt: 'asc' },
        });

        for (const c of candidates) {
            await this.prisma.like.create({
                data: { fromUserId: c.id, toUserId: userId, type: 'like' },
            });
        }

        if (candidates.length > 0) {
            this.logger.log(
                `🌱 dev: seeded ${candidates.length} incoming likes for ${me.email} — swipe right to match`,
            );
        }
    }

    // ── subscription ────────────────────────────────────────────
    async changePlan(userId: string, plan: SubscriptionPlan) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true, planExpiresAt: true },
        });
        if (!user) throw new NotFoundException('User not found');
        if (user.plan !== plan) {
            throw new ForbiddenException('Plan changes must be completed through verified checkout');
        }
        return { plan: user.plan, planExpiresAt: user.planExpiresAt };
    }

    // ── discover ────────────────────────────────────────────────
    async discover(viewerId: string, q: DiscoverQueryDto) {
        const viewer = await this.prisma.user.findUnique({
            where: { id: viewerId },
            include: { profile: true },
        });
        if (!viewer) throw new NotFoundException('Viewer not found');

        const oppositeGender =
            viewer.profile?.gender === 'male'
                ? 'female'
                : viewer.profile?.gender === 'female'
                  ? 'male'
                  : undefined;

        // Likes stay hidden from discovery. Passes remain a distinct recorded
        // decision but do not exclude candidates from a refreshed deck.
        const alreadyActed = await this.prisma.like.findMany({
            where: { fromUserId: viewerId, type: { in: ['like', 'superLike'] } },
            select: { toUserId: true },
        });
        const excludedIds = new Set(alreadyActed.map((l) => l.toUserId));

        // Never surface blocked users (either direction) in discovery.
        for (const id of await this.blockedIdsFor(viewerId)) excludedIds.add(id);

        const where: Prisma.UserWhereInput = {
            id: { not: viewerId, notIn: [...excludedIds] },
            isActive: true,
            incognitoMode: false,
            profileVisibility: 'everyone',
            profile: {
                isComplete: true,
                ...(oppositeGender && { gender: oppositeGender }),
                ...(q.prayerFrequency && { prayerFrequency: q.prayerFrequency }),
                ...(q.sect && { sect: q.sect }),
                ...(q.wearsHijab === true && {
                    hijabPreference: { in: ['hijab', 'niqab'] },
                }),
                ...(q.wearsHijab === false && {
                    hijabPreference: { in: ['notApplicable', 'preferNotToSay'] },
                }),
                ...(q.verifiedOnly && { isVerified: true }),
                ...(q.location && {
                    OR: [
                        { city: { contains: q.location } },
                        { country: { contains: q.location } },
                    ],
                }),
                ...(q.minAge != null || q.maxAge != null
                    ? {
                          dateOfBirth: {
                              ...(q.minAge != null
                                  ? {
                                        lte: new Date(
                                            new Date().getFullYear() - q.minAge,
                                            new Date().getMonth(),
                                            new Date().getDate(),
                                        ),
                                    }
                                  : {}),
                              ...(q.maxAge != null
                                  ? {
                                        gte: new Date(
                                            new Date().getFullYear() - q.maxAge,
                                            new Date().getMonth(),
                                            new Date().getDate(),
                                        ),
                                    }
                                  : {}),
                          },
                      }
                    : undefined),
            },
            ...(q.search && {
                OR: [
                    { name: { contains: q.search } },
                    { profile: { is: { city: { contains: q.search } } } },
                    { profile: { is: { country: { contains: q.search } } } },
                    { profile: { is: { profession: { contains: q.search } } } },
                ],
            }),
            ...(q.onlineOnly && {
                lastSeenAt: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) },
            }),
        };

        const page = q.page ?? 1;
        const limit = q.limit ?? 20;

        if (!oppositeGender) {
            return { total: 0, page, limit, results: [] };
        }

        const candidates = await this.prisma.user.findMany({
            where,
            include: {
                profile: true,
                onboardingAnswers: true,
                photos: { orderBy: { position: 'asc' }, take: 5 },
            },
        });

        // Interests filter (ANY match). Stored as a Json array, so filtered
        // in-memory rather than in the SQL where-clause.
        const wantInterests = (q.interests ?? '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        let scored = candidates
            .map((c) => {
                const details = this.compatibilityDetails(viewer, c);
                return {
                    user: c,
                    age: this.calcAge(c.profile?.dateOfBirth),
                    score: details.score,
                    reasons: details.reasons,
                };
            })
            .filter((c) => {
                if (q.minAge && (c.age ?? 0) < q.minAge) return false;
                if (q.maxAge && (c.age ?? 999) > q.maxAge) return false;
                if (wantInterests.length > 0) {
                    const ci = ((c.user.profile?.interests ?? []) as string[]).map(
                        (s) => s.toLowerCase(),
                    );
                    if (!wantInterests.some((w) => ci.includes(w))) return false;
                }
                return true;
            });

        // Randomize the entire eligible pool before pagination so repeated
        // refreshes are not limited to a deterministic top-N database slice.
        const sortBy = q.sortBy ?? 'compatibility';
        if (sortBy === 'compatibility') {
            for (let i = scored.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [scored[i], scored[j]] = [scored[j], scored[i]];
            }
        } else if (sortBy === 'age') {
            scored.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
        } else if (sortBy === 'name') {
            scored.sort((a, b) => a.user.name.localeCompare(b.user.name));
        }

        const total = scored.length;
        const slice = scored.slice((page - 1) * limit, page * limit);

        return {
            total,
            page,
            limit,
            results: slice.map((s) =>
                this.serializeProfile(
                    s.user,
                    { id: viewerId, plan: viewer.plan },
                    s.score,
                    s.reasons,
                    'none',
                    { mode: 'summary', maxPhotos: 2 },
                ),
            ),
        };
    }

    async getProfileById(viewerId: string, profileUserId: string) {
        const viewer = await this.prisma.user.findUnique({
            where: { id: viewerId },
            include: { profile: true },
        });
        if (!viewer) throw new NotFoundException('Viewer not found');

        // Don't leak a blocked user's profile (either direction).
        if ((await this.blockedIdsFor(viewerId)).has(profileUserId)) {
            throw new NotFoundException('Profile not found');
        }

        const target = await this.prisma.user.findUnique({
            where: { id: profileUserId },
            include: {
                profile: true,
                onboardingAnswers: true,
                photos: { orderBy: { position: 'asc' } },
            },
        });
        if (!target) throw new NotFoundException('Profile not found');

        const [a, b] = [viewerId, profileUserId].sort();
        const matched = await this.prisma.match.findUnique({
            where: { userAId_userBId: { userAId: a, userBId: b } },
        });
        if (viewerId !== profileUserId) {
            const visibleToViewer =
                target.profileVisibility === 'everyone' ||
                (target.profileVisibility === 'matchesOnly' && !!matched);
            if (!visibleToViewer) {
                throw new NotFoundException('Profile not found');
            }
            const updatedViewerCount = await this.prisma.user.update({
                where: { id: profileUserId },
                data: { profileViews: { increment: 1 } },
                select: { profileViews: true },
            });
            target.profileViews = updatedViewerCount.profileViews;
        }

        const details = this.compatibilityDetails(viewer, target);
        const access = await this.privateAccessFor(viewerId, profileUserId);
        const payload: any = this.serializeProfile(
            target,
            { id: viewerId, plan: viewer.plan },
            details.score,
            details.reasons,
            access,
        );
        if (matched && target.phone) payload.phone = target.phone;
        return payload;
    }

    // ── likes ───────────────────────────────────────────────────
    private async resetLikesIfNeeded(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: { plan: { select: { likesLimit: true, likesPeriod: true } } },
        });
        const period = user.plan === 'basic' ? 'lifetime' : (subscription?.plan.likesPeriod ?? 'day');
        if (period === 'lifetime') return user;

        const last = user.lastLikeReset;
        const now = new Date();
        const periodStart = period === 'month'
            ? new Date(now.getFullYear(), now.getMonth(), 1)
            : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (last < periodStart) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { likesUsedToday: 0, lastLikeReset: periodStart },
            });
            return { ...user, likesUsedToday: 0, lastLikeReset: periodStart };
        }
        return user;
    }

    private async checkWaliApproval(userId: string, targetUserId: string, actionType: 'like' | 'match_accept') {
        const member = await this.wali.getMemberFeatureState(userId);
        if (!member.enabled) return { pending: false, approvalIds: [] as string[] };
        const globalMatchApproval =
            actionType === 'match_accept' && member.waliApprovalForMatches;
        const links = await this.prisma.waliLink.findMany({
            where: {
                userId,
                status: 'active',
                ...(!globalMatchApproval &&
                    (actionType === 'like' ? { approveLikes: true } : { approveMatches: true })),
            },
            select: { waliId: true },
        });
        if (!links.length) {
            if (globalMatchApproval) {
                throw new ForbiddenException(
                    'An active Wali is required to approve this match. You can turn off Wali in settings.',
                );
            }
            return { pending: false, approvalIds: [] as string[] };
        }
        const approvals = await this.prisma.waliApproval.findMany({
            where: {
                userId,
                targetUserId,
                actionType,
                status: { in: ['pending', 'approved'] },
                expiresAt: { gt: new Date() },
            },
        });
        const approved = approvals.filter((approval) => approval.status === 'approved');
        const missing = links.filter((link) => !approved.some((approval) => approval.waliId === link.waliId));
        if (!missing.length) return { pending: false, approvalIds: approved.map((approval) => approval.id) };

        const pendingWalis = new Set(approvals.filter((approval) => approval.status === 'pending').map((approval) => approval.waliId));
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        for (const link of missing) {
            if (pendingWalis.has(link.waliId)) continue;
            const approval = await this.prisma.waliApproval.create({
                data: { waliId: link.waliId, userId, actionType, targetUserId, actionDetails: { targetUserId }, expiresAt },
            });
            void this.push.sendToUser(link.waliId, {
                title: 'Wali approval requested',
                body: 'A person you support is waiting for your approval before continuing.',
                data: { type: 'wali_approval', approvalId: approval.id },
            });
            this.realtime.emitToUser(link.waliId, 'wali:approval-requested', { approvalId: approval.id, userId, actionType, targetUserId, expiresAt });
        }
        return { pending: true, approvalIds: [] as string[] };
    }

    async likeProfile(viewerId: string, dto: LikeProfileDto, approvalAction: 'like' | 'match_accept' = 'like') {
        if (dto.toUserId === viewerId)
            throw new BadRequestException('Cannot like yourself');

        const target = await this.prisma.user.findUnique({
            where: { id: dto.toUserId },
        });
        if (!target) throw new NotFoundException('Target user not found');

        if (dto.type === 'pass') {
            await this.prisma.like.upsert({
                where: {
                    fromUserId_toUserId: {
                        fromUserId: viewerId,
                        toUserId: dto.toUserId,
                    },
                },
                update: { type: 'pass' },
                create: {
                    fromUserId: viewerId,
                    toUserId: dto.toUserId,
                    type: 'pass',
                },
            });
            return { success: true, matched: false };
        }

        let approvedWaliRequestIds: string[] = [];
        const approval = await this.checkWaliApproval(viewerId, dto.toUserId, approvalAction);
        if (approval.pending) return { success: true, matched: false, pendingApproval: true };
        approvedWaliRequestIds = approval.approvalIds;

        const viewer = await this.resetLikesIfNeeded(viewerId);
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId: viewerId },
            include: { plan: { select: { likesLimit: true, likesPeriod: true } } },
        });

        // Super-likes are a premium feature (Module B).
        if (dto.type === 'superLike' && viewer.plan === 'basic') {
            throw new ForbiddenException(
                'Super Likes are a Premium feature. Upgrade to send Super Likes.',
            );
        }

        const likesLimit = subscription?.plan.likesLimit ?? (viewer.plan === 'basic' ? 5 : null);
        if (likesLimit != null && viewer.likesUsedToday >= likesLimit) {
            throw new ForbiddenException(
                `Like limit reached for this ${subscription?.plan.likesPeriod ?? (viewer.plan === 'basic' ? 'lifetime' : 'day')} period.`,
            );
        }

        // Upsert the like
        await this.prisma.like.upsert({
            where: {
                fromUserId_toUserId: {
                    fromUserId: viewerId,
                    toUserId: dto.toUserId,
                },
            },
            update: { type: dto.type },
            create: {
                fromUserId: viewerId,
                toUserId: dto.toUserId,
                type: dto.type,
            },
        });

        if (approvedWaliRequestIds.length) {
            await this.prisma.waliApproval.updateMany({
                where: { id: { in: approvedWaliRequestIds }, status: 'approved' },
                data: { status: 'used' },
            });
        }

        await this.prisma.user.update({
            where: { id: viewerId },
            data: { likesUsedToday: { increment: 1 } },
        });

        // Check for mutual match
        let matched = false;
        if (dto.type === 'like' || dto.type === 'superLike') {
            const reverse = await this.prisma.like.findUnique({
                where: {
                    fromUserId_toUserId: {
                        fromUserId: dto.toUserId,
                        toUserId: viewerId,
                    },
                },
            });
            if (reverse && reverse.type !== 'pass') {
                const [a, b] = [viewerId, dto.toUserId].sort();
                await this.prisma.match.upsert({
                    where: { userAId_userBId: { userAId: a, userBId: b } },
                    update: {},
                    create: { userAId: a, userBId: b },
                });
                // Pre-create the conversation so both users have it ready in
                // their inbox immediately after matching.
                await this.prisma.conversation.upsert({
                    where: { userAId_userBId: { userAId: a, userBId: b } },
                    update: {},
                    create: { userAId: a, userBId: b },
                });
                matched = true;
            }
        }

        // Return enough info for the mobile UI to render an "It's a match!"
        // celebration with the partner's profile and a deep-link into chat.
        if (matched) {
            const target = await this.prisma.user.findUnique({
                where: { id: dto.toUserId },
                include: { profile: true, photos: { take: 1, orderBy: { position: 'asc' } } },
            });
            const viewerFull = await this.prisma.user.findUnique({
                where: { id: viewerId },
                include: { profile: true },
            });
            const [a, b] = [viewerId, dto.toUserId].sort();
            const conv = await this.prisma.conversation.findUnique({
                where: { userAId_userBId: { userAId: a, userBId: b } },
            });

            // Push the matched partner a notification (best-effort, no-op if
            // Firebase isn't configured). The viewer sees the in-app celebration.
            void this.push.sendToUser(dto.toUserId, {
                title: "It's a match! 💚",
                body: `You and ${viewerFull?.name ?? 'someone'} liked each other`,
                data: { type: 'match', conversationId: conv?.id ?? '' },
            });

            // Realtime: live "It's a match!" + notification badge for the peer.
            const matchPayload = {
                conversationId: conv?.id ?? null,
                partner: viewerFull
                    ? this.serializeProfile(viewerFull, { id: dto.toUserId, plan: viewerFull.plan })
                    : null,
            };
            this.realtime.emitToUser(dto.toUserId, 'match:new', matchPayload);
            this.realtime.emitToUser(dto.toUserId, 'notification:new', { kind: 'match' });

            // Live admin feed.
            this.realtime.emitAdminEvent(
                'match',
                `${viewerFull?.name ?? 'Someone'} ↔ ${target?.name ?? 'someone'} matched`,
                { conversationId: conv?.id ?? null },
            );

            return {
                success: true,
                matched: true,
                matchedUser: target
                    ? this.serializeProfile(
                          target,
                          viewerFull ? { id: viewerId, plan: viewerFull.plan } : null,
                      )
                    : null,
                conversationId: conv?.id ?? null,
            };
        }

        // Not a mutual match yet — let the recipient know someone liked them.
        // Super-likes are called out explicitly since they're the paid signal.
        if (dto.type === 'like' || dto.type === 'superLike') {
            void (async () => {
                try {
                    const liker = await this.prisma.user.findUnique({
                        where: { id: viewerId },
                        select: { name: true },
                    });
                    const isSuper = dto.type === 'superLike';
                    await this.push.sendToUser(dto.toUserId, {
                        title: isSuper ? 'You got a Super Like! ⭐' : 'Someone likes you 💚',
                        body: isSuper
                            ? `${liker?.name ?? 'Someone'} super liked your profile`
                            : 'Open Halal Connect to see who it is',
                        data: { type: 'likeRequest', fromUserId: viewerId },
                    });
                } catch {
                    // Push failures must never fail the like itself.
                }
            })();
        }

        return { success: true, matched };
    }

    async listMatches(viewerId: string) {
        const matches = await this.prisma.match.findMany({
            where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
            orderBy: { createdAt: 'desc' },
            include: {
                userA: { include: { profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
                userB: { include: { profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
            },
        });

        const viewer = await this.prisma.user.findUnique({
            where: { id: viewerId },
            include: { profile: true },
        });

        const blocked = await this.blockedIdsFor(viewerId);

        return matches
            .filter((m) => {
                const otherId = m.userAId === viewerId ? m.userBId : m.userAId;
                return !blocked.has(otherId);
            })
            .map((m) => {
            const other = m.userAId === viewerId ? m.userB : m.userA;
            const details = this.compatibilityDetails(viewer, other);
            return {
                matchId: m.id,
                matchedAt: m.createdAt,
                profile: this.serializeProfile(
                    other,
                    viewer ? { id: viewerId, plan: viewer.plan } : null,
                    details.score,
                    details.reasons,
                    'none',
                    { mode: 'summary', maxPhotos: 2 },
                ),
            };
        });
    }

    async listIncomingLikes(viewerId: string) {
        const likes = await this.prisma.like.findMany({
            where: {
                toUserId: viewerId,
                type: { in: ['like', 'superLike'] },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                fromUser: {
                    include: {
                        profile: true,
                        photos: { take: 1, orderBy: { position: 'asc' } },
                    },
                },
            },
        });

        const viewer = await this.prisma.user.findUnique({
            where: { id: viewerId },
            include: { profile: true },
        });
        if (!viewer) throw new NotFoundException('Viewer not found');
        const blocked = await this.blockedIdsFor(viewerId);

        return likes
            .filter((l) => !blocked.has(l.fromUserId))
            .map((l) => {
            const details = this.compatibilityDetails(viewer, l.fromUser);
            return {
                likeId: l.id,
                likedAt: l.createdAt,
                type: l.type,
                profile: this.serializeProfile(
                    l.fromUser,
                    viewer ? { id: viewerId, plan: viewer.plan } : null,
                    details.score,
                    details.reasons,
                    'none',
                    { mode: 'summary', maxPhotos: 2 },
                ),
            };
        });
    }

    // ── Matches: pending interests, accept / reject, compatibility ─
    /// `pending` = incoming interests not yet reciprocated; `accepted` = mutual
    /// matches. Mirrors the spec's GET /matches?status=accepted|pending.
    async matchesByStatus(userId: string, status?: string) {
        if (status === 'pending') return this.listIncomingLikes(userId);
        return this.listMatches(userId);
    }

    /// Convenience summary used by the dedicated matching API so the app can
    /// render pending and accepted matches in one round trip.
    async matchesSummary(userId: string) {
        const now = Date.now();
        const cached = this.matchesSummaryCache.get(userId);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }

        const [pending, accepted] = await Promise.all([
            this.listIncomingLikes(userId),
            this.listMatches(userId),
        ]);

        const result = {
            pendingCount: pending.length,
            acceptedCount: accepted.length,
            pending,
            accepted,
        } as const;

        this.matchesSummaryCache.set(userId, {
            expiresAt: now + this.matchesSummaryTtl,
            value: result,
        });

        return result;
    }

    /// Accept an incoming interest = like the person back (forms a match if it
    /// was a pending like). `otherUserId` is the interested user's id.
    async acceptInterest(userId: string, otherUserId: string) {
        return this.likeProfile(userId, { toUserId: otherUserId, type: 'like' }, 'match_accept');
    }

    /// Reject an incoming interest = pass on that user.
    async rejectInterest(userId: string, otherUserId: string) {
        return this.likeProfile(userId, { toUserId: otherUserId, type: 'pass' });
    }

    /// Compatibility breakdown between the viewer and another user: an overall
    /// score (0–100) plus the contributing reason strings.
    async compatibilityWith(viewerId: string, otherUserId: string) {
        const [viewer, other] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: viewerId },
                include: { profile: true },
            }),
            this.prisma.user.findUnique({
                where: { id: otherUserId },
                include: { profile: true },
            }),
        ]);
        if (!viewer || !other) throw new NotFoundException('User not found');

        const details = this.compatibilityDetails(viewer, other);
        return {
            userId: otherUserId,
            score: details.score,
            percentage: Math.round(details.score * 100),
            reasons: details.reasons,
        };
    }

    // ── Safety: block / unblock / report ─────────────────────────
    async blockUser(blockerId: string, targetId: string) {
        if (blockerId === targetId) {
            throw new BadRequestException('You cannot block yourself');
        }
        const target = await this.prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true },
        });
        if (!target) throw new NotFoundException('User not found');

        await this.prisma.block.upsert({
            where: {
                blockerId_blockedId: { blockerId, blockedId: targetId },
            },
            update: {},
            create: { blockerId, blockedId: targetId },
        });
        const grants = await this.prisma.photoAccessRequest.findMany({
            where: {
                OR: [
                    { requesterId: blockerId, ownerId: targetId },
                    { requesterId: targetId, ownerId: blockerId },
                ],
                status: 'granted',
            },
            select: { requesterId: true, ownerId: true },
        });
        if (grants.length > 0) {
            await this.prisma.photoAccessRequest.updateMany({
                where: {
                    OR: [
                        { requesterId: blockerId, ownerId: targetId },
                        { requesterId: targetId, ownerId: blockerId },
                    ],
                },
                data: { status: 'denied', expiresAt: null },
            });
            await this.prisma.photoAccessAudit.createMany({
                data: grants.map((grant) => ({ ...grant, action: 'revoke' })),
            });
        }
        return { success: true };
    }

    async unblockUser(blockerId: string, targetId: string) {
        await this.prisma.block.deleteMany({
            where: { blockerId, blockedId: targetId },
        });
        return { success: true };
    }

    async listBlocked(userId: string) {
        const blocks = await this.prisma.block.findMany({
            where: { blockerId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                blocked: {
                    include: {
                        profile: true,
                        photos: { take: 1, orderBy: { position: 'asc' } },
                    },
                },
            },
        });
        return blocks.map((b) => ({
            id: b.blocked.id,
            name: b.blocked.name,
            imageUrl:
                b.blocked.photos[0]?.url ??
                b.blocked.profile?.primaryImageUrl ??
                null,
            location: [b.blocked.profile?.city, b.blocked.profile?.country]
                .filter((v) => v)
                .join(', '),
            blockedAt: b.createdAt,
        }));
    }

    async reportUser(
        reporterId: string,
        targetId: string,
        reason: string,
        details?: string,
    ) {
        if (reporterId === targetId) {
            throw new BadRequestException('You cannot report yourself');
        }
        const target = await this.prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true },
        });
        if (!target) throw new NotFoundException('User not found');

        await this.prisma.report.create({
            data: {
                reporterId,
                reportedId: targetId,
                reason,
                details: details ?? null,
            },
        });

        // Live admin feed.
        this.realtime.emitAdminEvent('report', `New report filed · ${reason}`, {
            reportedId: targetId,
        });

        return { success: true };
    }

    // ── Wali / guardian ─────────────────────────────────────────
    async setWali(userId: string, dto: SetWaliDto) {
        await this.wali.assertMemberFeatureEnabled(userId);
        await this.prisma.profile.upsert({
            where: { userId },
            update: {
                waliName: dto.waliName,
                waliEmail: dto.waliEmail ?? null,
                waliPhone: dto.waliPhone ?? null,
                waliRelation: dto.waliRelation ?? null,
            },
            create: {
                userId,
                waliName: dto.waliName,
                waliEmail: dto.waliEmail ?? null,
                waliPhone: dto.waliPhone ?? null,
                waliRelation: dto.waliRelation ?? null,
            },
        });
        return this.getMe(userId);
    }

    // ── Photos (gallery management) ─────────────────────────────
    async listMyPhotos(userId: string) {
        const photos = await this.prisma.photo.findMany({
            where: { userId },
            orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }, { createdAt: 'asc' }],
        });
        return photos.map((p) => ({
            id: p.id,
            url: p.isPrivate || p.moderationStatus !== 'approved'
                ? this.signedPrivatePhotoUrl(p.id, userId)
                : p.url,
            isPrimary: p.isPrimary,
            isPrivate: p.isPrivate,
            moderationStatus: p.moderationStatus,
            moderationReason: p.moderationReason,
            flags: p.flags ?? [],
            position: p.position,
        }));
    }

    async adminPhotoQueue(adminId: string, status = 'pending', search?: string) {
        const photos = await this.prisma.photo.findMany({
            where: status === 'flagged'
                ? { flags: { not: Prisma.DbNull } }
                : { moderationStatus: status },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const filtered = photos.filter((photo) => !search ||
            `${photo.user.name} ${photo.user.email} ${photo.id}`.toLowerCase().includes(search.toLowerCase()));
        return filtered.map((photo) => ({
            id: photo.id,
            userId: photo.userId,
            user: photo.user,
            visibility: photo.isPrivate ? 'private' : 'public',
            url: this.signedPrivatePhotoUrl(photo.id, adminId, true),
            status: photo.moderationStatus,
            reason: photo.moderationReason,
            flags: Array.isArray(photo.flags) ? photo.flags : [],
            createdAt: photo.createdAt,
        }));
    }

    async reviewPhotoModeration(photoId: string, status: 'approved' | 'rejected', reason: string | undefined, adminId: string, adminEmail?: string) {
        const photo = await this.prisma.photo.findUnique({ where: { id: photoId }, include: { user: { select: { name: true } } } });
        if (!photo) throw new NotFoundException('Photo not found');
        const updated = await this.prisma.photo.update({
            where: { id: photoId },
            data: { moderationStatus: status, moderationReason: reason?.slice(0, 1000) ?? null },
        });
        await this.prisma.auditLog.create({
            data: { adminId, adminEmail, action: `photo ${status}`, target: JSON.stringify({ photoId, userId: photo.userId, reason: reason ?? null }) },
        });
        void this.push.sendToUser(photo.userId, {
            title: status === 'approved' ? 'Photo approved' : 'Photo needs attention',
            body: status === 'approved' ? 'Your photo is now visible to other members.' : (reason ?? 'Please choose a different profile photo.'),
            data: { type: 'photo_moderation', photoId, status },
        });
        this.realtime.emitToUser(photo.userId, 'notification:new', { kind: 'photo_moderation', photoId, status });
        this.realtime.emitAdminEvent('moderation', `${photo.user.name}'s photo ${status}`, { photoId, userId: photo.userId });
        return { id: updated.id, status: updated.moderationStatus, reason: updated.moderationReason };
    }

    async reviewPhotoModerationBulk(
        photoIds: string[],
        status: 'approved' | 'rejected',
        reason: string | undefined,
        adminId: string,
        adminEmail?: string,
    ) {
        if (status !== 'approved' && status !== 'rejected') {
            throw new BadRequestException('Invalid photo review status');
        }
        if (!Array.isArray(photoIds)) throw new BadRequestException('Photo IDs are required');
        const ids = [...new Set(photoIds)];
        if (ids.length === 0 || ids.length > 50) {
            throw new BadRequestException('Select between 1 and 50 photos');
        }

        const photos = await this.prisma.photo.findMany({
            where: { id: { in: ids } },
            include: { user: { select: { id: true, name: true } } },
        });
        if (photos.length !== ids.length) throw new NotFoundException('One or more photos were not found');
        const userId = photos[0].userId;
        const memberName = photos[0].user.name;
        if (photos.some((photo) => photo.userId !== userId)) {
            throw new BadRequestException('Photos in a review must belong to the same member');
        }

        const moderationReason = reason?.slice(0, 1000) ?? null;
        await this.prisma.$transaction(async (tx) => {
            await tx.photo.updateMany({
                where: { id: { in: ids }, userId },
                data: { moderationStatus: status, moderationReason },
            });
            await tx.auditLog.createMany({
                data: photos.map((photo) => ({
                    adminId,
                    adminEmail,
                    action: `photo ${status}`,
                    target: JSON.stringify({
                        photoId: photo.id,
                        userId,
                        reason: moderationReason,
                        bulkCount: ids.length,
                    }),
                })),
            });
        });

        const count = ids.length;
        const label = count === 1 ? 'photo' : 'photos';
        const approved = status === 'approved';
        const body = approved
            ? `${count} ${label} ${count === 1 ? 'is' : 'are'} approved and now visible on your profile.`
            : `${count} ${label} ${count === 1 ? 'needs' : 'need'} changes.${moderationReason ? ` ${moderationReason}` : ' Please choose a different photo.'}`;
        void this.push.sendToUser(userId, {
            title: approved ? (count === 1 ? 'Photo approved' : 'Photos approved') : 'Photo review update',
            body,
            data: { type: 'photo_moderation', status, count },
        });
        this.realtime.emitToUser(userId, 'notification:new', {
            kind: 'photo_moderation',
            status,
            count,
            title: approved ? (count === 1 ? 'Photo approved' : 'Photos approved') : 'Photo review update',
            body,
        });
        this.realtime.emitAdminEvent(
            'moderation',
            `${memberName}'s ${count} ${label} ${status}`,
            { userId, photoIds: ids, count },
        );
        return { count, status };
    }

    async adminPhotoRequests() {
        return this.prisma.photoAccessRequest.findMany({
            include: {
                requester: { select: { id: true, name: true } },
                owner: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
    }

    async adminRevokePhotoRequest(requestId: string, adminId: string, reason?: string) {
        const request = await this.prisma.photoAccessRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Photo access request not found');
        await this.prisma.photoAccessRequest.update({ where: { id: requestId }, data: { status: 'revoked', expiresAt: new Date() } });
        await this.prisma.photoAccessAudit.create({
            data: { requesterId: request.requesterId, ownerId: request.ownerId, action: 'admin_revoke' },
        });
        await this.prisma.auditLog.create({
            data: { adminId, action: 'photo access admin_revoke', target: JSON.stringify({ requestId, reason: reason ?? 'Admin safety override' }) },
        });
        return { success: true, status: 'revoked' };
    }

    /// Persist newly-uploaded photo files. The first photo ever uploaded
    /// becomes the (public) primary and is mirrored onto Profile.primaryImageUrl.
    async addPhotos(
        userId: string,
        files: Array<{ url: string }>,
        opts: { isPrivate?: boolean } = {},
    ) {
        if (!files.length) throw new BadRequestException('No files uploaded');

        const existingCount = await this.prisma.photo.count({ where: { userId } });
        const created: any[] = [];
        let position = existingCount;

        for (const f of files) {
            // Only public photos may become the primary avatar.
            const makePrimary = existingCount === 0 && created.length === 0 && !opts.isPrivate;
            const photo = await this.prisma.photo.create({
                data: {
                    userId,
                    url: f.url,
                    isPrimary: makePrimary,
                    isPrivate: opts.isPrivate ?? false,
                    moderationStatus: 'pending',
                    position: position++,
                },
            });
            created.push(photo);
            if (makePrimary) {
                await this.prisma.profile.upsert({
                    where: { userId },
                    update: { primaryImageUrl: f.url },
                    create: { userId, primaryImageUrl: f.url },
                });
            }
        }

        await this.refreshIsComplete(userId);
        return this.listMyPhotos(userId);
    }

    async updatePhoto(userId: string, photoId: string, dto: UpdatePhotoDto) {
        const photo = await this.prisma.photo.findFirst({
            where: { id: photoId, userId },
        });
        if (!photo) throw new NotFoundException('Photo not found');

        // A private photo can never be the public primary.
        const willBePrivate = dto.isPrivate ?? photo.isPrivate;
        if (dto.isPrimary === true && willBePrivate) {
            throw new BadRequestException('A private photo cannot be your primary photo');
        }

        if (dto.isPrimary === true) {
            // Demote any current primary, then promote this one.
            await this.prisma.photo.updateMany({
                where: { userId, isPrimary: true },
                data: { isPrimary: false },
            });
            await this.prisma.profile.update({
                where: { userId },
                data: { primaryImageUrl: photo.url },
            });
        }

        const updated = await this.prisma.photo.update({
            where: { id: photoId },
            data: {
                ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
                ...(dto.isPrimary === true && { isPrimary: true }),
            },
        });
        return {
            id: updated.id,
            url: updated.isPrivate || updated.moderationStatus !== 'approved'
                ? this.signedPrivatePhotoUrl(updated.id, userId)
                : updated.url,
            isPrimary: updated.isPrimary,
            isPrivate: updated.isPrivate,
            moderationStatus: updated.moderationStatus,
        };
    }

    async deletePhoto(userId: string, photoId: string) {
        const photo = await this.prisma.photo.findFirst({
            where: { id: photoId, userId },
        });
        if (!photo) throw new NotFoundException('Photo not found');

        await this.prisma.photo.delete({ where: { id: photoId } });

        // Best-effort remove the file from disk (url is /uploads/...).
        try {
            const abs = join(process.cwd(), photo.url.replace(/^\//, ''));
            if (existsSync(abs)) unlinkSync(abs);
        } catch (e) {
            this.logger.warn(`Failed to delete photo file ${photo.url}: ${String(e)}`);
        }

        // If we removed the primary, promote the next public photo (if any).
        if (photo.isPrimary) {
            const next = await this.prisma.photo.findFirst({
                where: { userId, isPrivate: false },
                orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            });
            await this.prisma.profile.update({
                where: { userId },
                data: { primaryImageUrl: next?.url ?? null },
            });
            if (next) {
                await this.prisma.photo.update({
                    where: { id: next.id },
                    data: { isPrimary: true },
                });
            }
        }

        await this.refreshIsComplete(userId);
        return { success: true };
    }

    // ── Private-photo access (request / grant) ──────────────────
    private async privateAccessFor(
        viewerId: string,
        ownerId: string,
    ): Promise<'none' | 'pending' | 'granted'> {
        if (viewerId === ownerId) return 'granted';
        const req = await this.prisma.photoAccessRequest.findUnique({
            where: { requesterId_ownerId: { requesterId: viewerId, ownerId } },
        });
        if (!req) return 'none';
        if (req.status === 'granted' && (!req.expiresAt || req.expiresAt > new Date())) return 'granted';
        if (req.status === 'pending' && (!req.expiresAt || req.expiresAt > new Date())) return 'pending';
        return 'none';
    }

    async requestPhotoAccess(requesterId: string, ownerId: string, reason?: string) {
        if (requesterId === ownerId) {
            throw new BadRequestException('You cannot request your own photos');
        }
        if ((await this.blockedIdsFor(requesterId)).has(ownerId)) {
            throw new NotFoundException('User not found');
        }
        const [owner, match] = await Promise.all([this.prisma.user.findUnique({
            where: { id: ownerId },
            select: { id: true },
        }), this.prisma.match.findFirst({
            where: { OR: [{ userAId: requesterId, userBId: ownerId }, { userAId: ownerId, userBId: requesterId }] },
            select: { id: true },
        })]);
        if (!owner) throw new NotFoundException('User not found');
        if (!match) throw new ForbiddenException('Private photo access requires an active match');

        const req = await this.prisma.photoAccessRequest.upsert({
            where: { requesterId_ownerId: { requesterId, ownerId } },
            // Re-requesting after a denial resets it to pending.
            update: { status: 'pending', reason: reason?.slice(0, 500) ?? null, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
            create: { requesterId, ownerId, status: 'pending', reason: reason?.slice(0, 500) ?? null, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
        await this.prisma.photoAccessAudit.create({ data: { requesterId, ownerId, action: 'request' } });
        this.realtime.emitToUser(ownerId, 'notification:new', { kind: 'photoRequest', requesterId });
        void this.push.sendToUser(ownerId, {
            title: 'Private photo request',
            body: 'Someone requested access to your private photos.',
            data: { type: 'photoRequest', requesterId },
        });
        return { success: true, status: req.status };
    }

    async respondPhotoRequestById(ownerId: string, requestId: string, grant: boolean) {
        const request = await this.prisma.photoAccessRequest.findFirst({
            where: { id: requestId, ownerId, status: 'pending' },
        });
        if (!request) throw new NotFoundException('Photo request not found');
        if (request.expiresAt && request.expiresAt <= new Date()) {
            await this.prisma.photoAccessRequest.update({
                where: { id: request.id }, data: { status: 'denied' },
            });
            await this.prisma.photoAccessAudit.create({
                data: { requesterId: request.requesterId, ownerId, action: 'expire' },
            });
            throw new NotFoundException('Photo request has expired');
        }
        return this.respondPhotoAccess(ownerId, request.requesterId, grant);
    }

    /// Owner responds to a pending request. `grant=false` denies it.
    async respondPhotoAccess(ownerId: string, requesterId: string, grant: boolean) {
        const req = await this.prisma.photoAccessRequest.findUnique({
            where: { requesterId_ownerId: { requesterId, ownerId } },
        });
        if (!req) throw new NotFoundException('No such request');

        const updated = await this.prisma.photoAccessRequest.update({
            where: { id: req.id },
            data: { status: grant ? 'granted' : 'denied', expiresAt: null },
        });
        await this.prisma.photoAccessAudit.create({
            data: { requesterId, ownerId, action: grant ? 'grant' : 'decline' },
        });
        this.realtime.emitToUser(requesterId, 'notification:new', { kind: grant ? 'photoGranted' : 'photoDenied', ownerId });
        void this.push.sendToUser(requesterId, {
            title: grant ? 'Private photos unlocked' : 'Private photo request declined',
            body: grant ? 'You can now view the permitted private photos.' : 'Your private photo request was declined.',
            data: { type: grant ? 'photoGranted' : 'photoDenied', ownerId },
        });
        return { success: true, status: updated.status };
    }

    /// Pending inbound private-photo requests for the owner to act on.
    async listPhotoRequests(ownerId: string) {
        const reqs = await this.prisma.photoAccessRequest.findMany({
            where: { ownerId, status: 'pending', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            orderBy: { createdAt: 'desc' },
            include: {
                requester: {
                    include: {
                        profile: true,
                        photos: { where: { isPrivate: false }, take: 1, orderBy: { position: 'asc' } },
                    },
                },
            },
        });
        return reqs.map((r) => ({
            requestId: r.id,
            requestedAt: r.createdAt,
            requester: {
                id: r.requester.id,
                name: r.requester.name,
                imageUrl:
                    r.requester.photos[0]?.url ??
                    r.requester.profile?.primaryImageUrl ??
                    null,
                location: [r.requester.profile?.city, r.requester.profile?.country]
                    .filter(Boolean)
                    .join(', '),
            },
        }));
    }

    async listPhotoGrants(ownerId: string) {
        const grants = await this.prisma.photoAccessRequest.findMany({
            where: { ownerId, status: 'granted' },
            include: { requester: { select: { id: true, name: true, email: true } } },
            orderBy: { updatedAt: 'desc' },
        });
        return grants.filter((grant) => !grant.expiresAt || grant.expiresAt > new Date()).map((grant) => ({
            userId: grant.requesterId,
            name: grant.requester.name,
            email: grant.requester.email,
            grantedAt: grant.updatedAt,
        }));
    }

    async revokePhotoGrant(ownerId: string, requesterId: string) {
        const grant = await this.prisma.photoAccessRequest.findUnique({
            where: { requesterId_ownerId: { requesterId, ownerId } },
        });
        if (!grant || grant.status !== 'granted') throw new NotFoundException('Photo grant not found');
        await this.prisma.photoAccessRequest.update({
            where: { id: grant.id }, data: { status: 'denied', expiresAt: null },
        });
        await this.prisma.photoAccessAudit.create({ data: { requesterId, ownerId, action: 'revoke' } });
        return { success: true };
    }

    async unmatch(viewerId: string, matchId: string) {
        const match = await this.prisma.match.findFirst({
            where: { id: matchId, OR: [{ userAId: viewerId }, { userBId: viewerId }] },
        });
        if (!match) throw new NotFoundException('Match not found');
        const otherId = match.userAId === viewerId ? match.userBId : match.userAId;
        const pair: [string, string] = viewerId < otherId
            ? [viewerId, otherId]
            : [otherId, viewerId];
        await this.prisma.$transaction(async (tx) => {
            await tx.photoAccessRequest.deleteMany({
                where: { OR: [{ requesterId: viewerId, ownerId: otherId }, { requesterId: otherId, ownerId: viewerId }] },
            });
            await tx.conversation.deleteMany({ where: { userAId: pair[0], userBId: pair[1] } });
            await tx.match.delete({ where: { id: matchId } });
        });
        return { success: true };
    }
}
