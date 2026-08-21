import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    private isOnline(lastSeenAt: Date | null | undefined): boolean {
        if (!lastSeenAt) return false;
        return Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
    }

    private calcAge(dob: Date | null | undefined): number | null {
        if (!dob) return null;
        const now = new Date();
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
        return age;
    }

    private serializePartner(u: any) {
        const profile = u.profile ?? {};
        const city = profile.city as string | null;
        const country = profile.country as string | null;
        const photos: Array<{ url: string }> = u.photos ?? [];
        const imageUrl = this.toRelativeAssetPath(profile.primaryImageUrl ?? photos[0]?.url ?? null);
        return {
            id: u.id,
            name: u.name,
            // Fall back to the first gallery photo if no primary is set.
            imageUrl,
            isOnline: u.incognitoMode === true || u.showOnlineStatus === false ? false : this.isOnline(u.lastSeenAt),
            isVerified: profile.isVerified ?? false,
            age: this.calcAge(profile.dateOfBirth),
            location: [city, country].filter(Boolean).join(', '),
        };
    }

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

    /// Return a chronologically-merged feed of two types:
    ///   - "match": a Match row this user is part of
    ///   - "likeRequest": an incoming Like that hasn't yet led to a match
    ///                    (i.e. the viewer hasn't liked them back)
    /// Each item carries an `isRead` flag derived from User.notificationsReadAt.
    async list(userId: string) {
        const me = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!me) return [];

        const readMarker = me.notificationsReadAt;
        const isRead = (createdAt: Date) =>
            !!readMarker && createdAt <= readMarker;

        const [matches, incomingLikes, conversationsByPair] = await Promise.all([
            this.prisma.match.findMany({
                where: { OR: [{ userAId: userId }, { userBId: userId }] },
                orderBy: { createdAt: 'desc' },
                include: {
                    userA: {
                        include: {
                            profile: true,
                            photos: { take: 1, orderBy: { position: 'asc' } },
                        },
                    },
                    userB: {
                        include: {
                            profile: true,
                            photos: { take: 1, orderBy: { position: 'asc' } },
                        },
                    },
                },
            }),
            this.prisma.like.findMany({
                where: {
                    toUserId: userId,
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
            }),
            this.prisma.conversation.findMany({
                where: { OR: [{ userAId: userId }, { userBId: userId }] },
                select: { id: true, userAId: true, userBId: true },
            }),
        ]);

        // Build a (sorted-pair → conversationId) lookup so match notifications
        // can deep-link straight into chat.
        const convByPair = new Map<string, string>();
        for (const c of conversationsByPair) {
            const key = [c.userAId, c.userBId].sort().join(':');
            convByPair.set(key, c.id);
        }

        const matchItems = matches.map((m) => {
            const partner = m.userAId === userId ? m.userB : m.userA;
            const key = [m.userAId, m.userBId].sort().join(':');
            return {
                id: `match-${m.id}`,
                type: 'match' as const,
                createdAt: m.createdAt,
                isRead: isRead(m.createdAt),
                partner: this.serializePartner(partner),
                conversationId: convByPair.get(key) ?? null,
                isSuperLike: false,
            };
        });

        const matchedPartnerIds = new Set(
            matches.map((m) => (m.userAId === userId ? m.userBId : m.userAId)),
        );

        const likeItems = incomingLikes
            .filter((l) => {
                // Hide likes that have already become matches (rendered above)
                if (matchedPartnerIds.has(l.fromUserId)) return false;
                return true;
            })
            .map((l) => ({
                id: `like-${l.id}`,
                type: 'likeRequest' as const,
                createdAt: l.createdAt,
                isRead: isRead(l.createdAt),
                partner: this.serializePartner(l.fromUser),
                conversationId: null,
                isSuperLike: l.type === 'superLike',
            }));

        // Newest first
        const all = [...matchItems, ...likeItems];
        all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return all;
    }

    /// Returns the count of unread items, cheap for badge rendering.
    async unreadCount(userId: string) {
        const items = await this.list(userId);
        return { count: items.filter((i) => !i.isRead).length };
    }

    async markAllRead(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { notificationsReadAt: new Date() },
        });
        return { success: true };
    }
}
