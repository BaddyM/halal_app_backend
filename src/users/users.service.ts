import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
    UpdateProfileDto,
    SubmitOnboardingDto,
    DiscoverQueryDto,
    LikeProfileDto,
    SetWaliDto,
    UpdatePhotoDto,
} from './dto';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 min

@Injectable()
export class UsersService {
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
    ) {}

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
        const allPhotos: Array<{ id: string; url: string; isPrimary?: boolean; isPrivate?: boolean }> =
            user.photos ?? [];
        const isSelf = viewer?.id === user.id;
        const canSeePrivate = isSelf || privateAccess === 'granted';
        const mode = options?.mode ?? 'full';
        const maxPhotos = Math.max(1, options?.maxPhotos ?? (mode === 'summary' ? 3 : 10));

        const publicPhotos = allPhotos.filter((p) => !p.isPrivate);
        const privatePhotos = allPhotos.filter((p) => p.isPrivate);

        // Detailed photo list. The owner sees everything (with privacy flags);
        // a viewer sees public photos plus, only if granted, the private ones.
        const visiblePhotos = canSeePrivate ? allPhotos : publicPhotos;
        const visibleSlice = visiblePhotos.slice(0, maxPhotos);
        const photos = visibleSlice.map((p) => ({
            id: p.id,
            url: this.toRelativeAssetPath(p.url),
            isPrimary: p.isPrimary ?? false,
            isPrivate: p.isPrivate ?? false,
        }));
        const galleryImages = visibleSlice.map((p) => this.toRelativeAssetPath(p.url));
        const primaryImage = this.toRelativeAssetPath(
            profile?.primaryImageUrl ?? publicPhotos[0]?.url ?? null,
        );

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
            isOnline: this.isOnline(user.lastSeenAt),
            lastSeenAt: user.lastSeenAt,
            compatibilityScore,
            matchReasons,
        };

        if (mode === 'summary') {
            return basePayload;
        }

        return {
            ...basePayload,
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
            prayerTimesEnabled: isSelf ? user.prayerTimesEnabled : undefined,
            readReceiptsEnabled: isSelf ? user.readReceiptsEnabled : undefined,
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
            { key: 'hijabPreference', label: 'Hijab/appearance', weight: 1, done: !!p.hijabPreference },
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

    private compatibilityDetails(
        viewer: any,
        candidate: any,
    ): { score: number; reasons: string[] } {
        if (!viewer?.profile || !candidate?.profile) {
            return { score: 0.5, reasons: [] };
        }

        const v = viewer.profile;
        const c = candidate.profile;

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

        if (v.hijabPreference && v.hijabPreference === c.hijabPreference) {
            add(true, 1);
        } else {
            add(false, 1);
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
            include: { profile: true, photos: { orderBy: { position: 'asc' } } },
        });
        if (!user) throw new NotFoundException('User not found');
        await this.touchLastSeen(userId);
        return this.serializeProfile(user, { id: userId, plan: user.plan });
    }

    async touchLastSeen(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastSeenAt: new Date() },
        });
    }

    // ── profile ────────────────────────────────────────────────
    async updateProfile(userId: string, dto: UpdateProfileDto) {
        if (dto.name !== undefined) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { name: dto.name },
            });
        }

        if (dto.phone !== undefined) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { phone: dto.phone },
            });
        }

        if (
            dto.prayerTimesEnabled !== undefined ||
            dto.halalVerificationSubmitted !== undefined ||
            dto.readReceiptsEnabled !== undefined
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
            ...(dto.hijabPreference !== undefined && {
                hijabPreference: dto.hijabPreference,
            }),
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
        };

        await this.prisma.profile.upsert({
            where: { userId },
            update: data,
            create: { userId, ...(data as any) },
        });

        await this.refreshIsComplete(userId);
        return this.getMe(userId);
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
            if (p.startsWith('5')) profileUpdate.prayerFrequency = 'fiveTimes';
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

        const timeline = map.get('marriage_timeline');
        if (typeof timeline === 'string') {
            const t = timeline.toLowerCase();
            if (t.includes('soon')) profileUpdate.maritalTimeline = 'asap';
            else if (t.includes('within 1 year')) profileUpdate.maritalTimeline = 'withinYear';
            else if (t.includes('1–2') || t.includes('1-2')) profileUpdate.maritalTimeline = 'oneToTwoYears';
            else profileUpdate.maritalTimeline = 'openTimeline';
        }

        const ethnicity = map.get('ethnicity');
        if (typeof ethnicity === 'string') profileUpdate.ethnicity = ethnicity;

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
            await this.prisma.profile.upsert({
                where: { userId },
                update: profileUpdate,
                create: { userId, ...(profileUpdate as any) },
            });
            await this.refreshIsComplete(userId);
        }

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
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                plan,
                planExpiresAt:
                    plan === 'premium'
                        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        : null,
                // Reset basic limits if upgrading
                ...(plan !== 'basic' && { likesUsedToday: 0, activeChatsCount: 0 }),
            },
        });
        return { plan: updated.plan, planExpiresAt: updated.planExpiresAt };
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

        // Hide users the viewer has already swiped on (like / superLike / pass).
        // They reappear only if the viewer un-likes them (not supported yet).
        const alreadyActed = await this.prisma.like.findMany({
            where: { fromUserId: viewerId },
            select: { toUserId: true },
        });
        const excludedIds = new Set(alreadyActed.map((l) => l.toUserId));

        // Never surface blocked users (either direction) in discovery.
        for (const id of await this.blockedIdsFor(viewerId)) excludedIds.add(id);

        const where: Prisma.UserWhereInput = {
            id: { not: viewerId, notIn: [...excludedIds] },
            isActive: true,
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

        const candidates = await this.prisma.user.findMany({
            where,
            include: {
                profile: true,
                photos: { orderBy: { position: 'asc' }, take: 5 },
            },
            take: 200,
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

        // Apply basic plan visibility filter
        if (viewer.plan === 'basic') {
            scored = scored.filter((c) => c.score >= 0.85);
        }

        // Sort
        const sortBy = q.sortBy ?? 'compatibility';
        if (sortBy === 'compatibility') {
            scored.sort((a, b) => b.score - a.score);
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
            include: { profile: true, photos: { orderBy: { position: 'asc' } } },
        });
        if (!target) throw new NotFoundException('Profile not found');

        const details = this.compatibilityDetails(viewer, target);
        const access = await this.privateAccessFor(viewerId, profileUserId);
        return this.serializeProfile(
            target,
            { id: viewerId, plan: viewer.plan },
            details.score,
            details.reasons,
            access,
        );
    }

    // ── likes ───────────────────────────────────────────────────
    private async resetDailyLikesIfNeeded(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const last = user.lastLikeReset;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (last < startOfToday) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { likesUsedToday: 0, lastLikeReset: startOfToday },
            });
            return { ...user, likesUsedToday: 0, lastLikeReset: startOfToday };
        }
        return user;
    }

    async likeProfile(viewerId: string, dto: LikeProfileDto) {
        if (dto.toUserId === viewerId)
            throw new BadRequestException('Cannot like yourself');

        const target = await this.prisma.user.findUnique({
            where: { id: dto.toUserId },
        });
        if (!target) throw new NotFoundException('Target user not found');

        const viewer = await this.resetDailyLikesIfNeeded(viewerId);

        // Super-likes are a premium feature (Module B).
        if (dto.type === 'superLike' && viewer.plan === 'basic') {
            throw new ForbiddenException(
                'Super Likes are a Premium feature. Upgrade to send Super Likes.',
            );
        }

        if (dto.type !== 'pass') {
            // Enforce basic plan daily like limit
            if (viewer.plan === 'basic' && viewer.likesUsedToday >= 5) {
                throw new ForbiddenException(
                    'Daily like limit reached. Upgrade to Premium for unlimited likes.',
                );
            }
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

        if (dto.type !== 'pass') {
            await this.prisma.user.update({
                where: { id: viewerId },
                data: { likesUsedToday: { increment: 1 } },
            });
        }

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
        return this.likeProfile(userId, { toUserId: otherUserId, type: 'like' });
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
            url: p.url,
            isPrimary: p.isPrimary,
            isPrivate: p.isPrivate,
            position: p.position,
        }));
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
            url: updated.url,
            isPrimary: updated.isPrimary,
            isPrivate: updated.isPrivate,
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
        if (req.status === 'granted') return 'granted';
        if (req.status === 'pending') return 'pending';
        return 'none';
    }

    async requestPhotoAccess(requesterId: string, ownerId: string) {
        if (requesterId === ownerId) {
            throw new BadRequestException('You cannot request your own photos');
        }
        if ((await this.blockedIdsFor(requesterId)).has(ownerId)) {
            throw new NotFoundException('User not found');
        }
        const owner = await this.prisma.user.findUnique({
            where: { id: ownerId },
            select: { id: true },
        });
        if (!owner) throw new NotFoundException('User not found');

        const req = await this.prisma.photoAccessRequest.upsert({
            where: { requesterId_ownerId: { requesterId, ownerId } },
            // Re-requesting after a denial resets it to pending.
            update: { status: 'pending' },
            create: { requesterId, ownerId, status: 'pending' },
        });
        return { success: true, status: req.status };
    }

    /// Owner responds to a pending request. `grant=false` denies it.
    async respondPhotoAccess(ownerId: string, requesterId: string, grant: boolean) {
        const req = await this.prisma.photoAccessRequest.findUnique({
            where: { requesterId_ownerId: { requesterId, ownerId } },
        });
        if (!req) throw new NotFoundException('No such request');

        const updated = await this.prisma.photoAccessRequest.update({
            where: { id: req.id },
            data: { status: grant ? 'granted' : 'denied' },
        });
        return { success: true, status: updated.status };
    }

    /// Pending inbound private-photo requests for the owner to act on.
    async listPhotoRequests(ownerId: string) {
        const reqs = await this.prisma.photoAccessRequest.findMany({
            where: { ownerId, status: 'pending' },
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
}
