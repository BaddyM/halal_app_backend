import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { containsFlaggedWord } from './moderation';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly bus: RealtimeBus,
    ) {}

    // Sort a pair so we always store/lookup with userA < userB.
    private pair(a: string, b: string): [string, string] {
        return a < b ? [a, b] : [b, a];
    }

    private isOnline(lastSeenAt: Date | null | undefined) {
        if (!lastSeenAt) return false;
        return Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
    }

    private async isBlockedBetween(a: string, b: string): Promise<boolean> {
        const block = await this.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: a, blockedId: b },
                    { blockerId: b, blockedId: a },
                ],
            },
            select: { id: true },
        });
        return block != null;
    }

    private serializePartner(user: any) {
        return {
            id: user.id,
            name: user.name,
            imageUrl: user.profile?.primaryImageUrl ?? null,
            isOnline: this.isOnline(user.lastSeenAt),
            isVerified: user.profile?.isVerified ?? false,
        };
    }

    private serializeMessage(m: any) {
        return {
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            text: m.text,
            type: m.type ?? 'text',
            mediaUrl: m.mediaUrl ?? null,
            flagged: m.flagged ?? false,
            createdAt: m.createdAt,
            readAt: m.readAt,
        };
    }

    // ── Start or fetch a conversation ───────────────────────────
    async findOrCreate(meId: string, otherUserId: string) {
        if (meId === otherUserId) {
            throw new BadRequestException('Cannot start a chat with yourself');
        }
        const other = await this.prisma.user.findUnique({
            where: { id: otherUserId },
            include: { profile: true },
        });
        if (!other) throw new NotFoundException('User not found');

        if (await this.isBlockedBetween(meId, otherUserId)) {
            throw new ForbiddenException('You cannot message this user.');
        }

        const [a, b] = this.pair(meId, otherUserId);
        // Match-gate: dating-app convention — both users must have liked
        // each other before a chat can exist.
        const match = await this.prisma.match.findUnique({
            where: { userAId_userBId: { userAId: a, userBId: b } },
        });
        if (!match) {
            throw new ForbiddenException(
                'You can only message someone after you have both liked each other.',
            );
        }

        const conv = await this.prisma.conversation.upsert({
            where: { userAId_userBId: { userAId: a, userBId: b } },
            update: {},
            create: { userAId: a, userBId: b },
        });

        return {
            id: conv.id,
            createdAt: conv.createdAt,
            lastMessageAt: conv.lastMessageAt,
            partner: this.serializePartner(other),
            lastMessage: null,
            unreadCount: 0,
            isTyping: false,
            isHalalVerified: other.profile?.isVerified ?? false,
            waliInvolved: conv.waliInvolved,
        };
    }

    /// Ensure a Conversation row exists for every match the user is in. Cheap
    /// and idempotent (createMany + skipDuplicates) — only creates the missing
    /// ones. Keeps the chat list authoritative so matches are never "lost".
    private async backfillMatchConversations(userId: string) {
        const matches = await this.prisma.match.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            select: { userAId: true, userBId: true },
        });
        if (matches.length === 0) return;

        const existing = await this.prisma.conversation.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            select: { userAId: true, userBId: true },
        });
        const existingPairs = new Set(
            existing.map((c) => `${c.userAId}:${c.userBId}`),
        );

        const toCreate = matches
            .map((m) => this.pair(m.userAId, m.userBId))
            .filter(([a, b]) => !existingPairs.has(`${a}:${b}`))
            .map(([a, b]) => ({ userAId: a, userBId: b }));

        if (toCreate.length > 0) {
            await this.prisma.conversation.createMany({
                data: toCreate,
                skipDuplicates: true,
            });
        }
    }

    // ── List conversations for a user ───────────────────────────
    async listConversations(userId: string) {
        // Self-heal: every match should be reachable in chat. If a match's
        // conversation row was never created (old match, race, etc.), create it
        // now so matches always appear in the list — even with no messages yet.
        await this.backfillMatchConversations(userId);

        const allConversations = await this.prisma.conversation.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            orderBy: { lastMessageAt: 'desc' },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        // Hide conversations with users that have been blocked (either way).
        const blocks = await this.prisma.block.findMany({
            where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
            select: { blockerId: true, blockedId: true },
        });
        const blockedIds = new Set(
            blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)),
        );
        const conversations = allConversations.filter((c) => {
            const partnerId = c.userAId === userId ? c.userBId : c.userAId;
            return !blockedIds.has(partnerId);
        });

        // Unread counts grouped per conversation.
        const unread = await this.prisma.message.groupBy({
            by: ['conversationId'],
            where: {
                conversationId: { in: conversations.map((c) => c.id) },
                senderId: { not: userId },
                readAt: null,
            },
            _count: { _all: true },
        });
        const unreadMap = new Map(
            unread.map((u) => [u.conversationId, u._count._all]),
        );

        return conversations.map((c) => {
            const partnerUser = c.userAId === userId ? c.userB : c.userA;
            const last = c.messages[0];
            return {
                id: c.id,
                createdAt: c.createdAt,
                lastMessageAt: c.lastMessageAt,
                partner: this.serializePartner(partnerUser),
                lastMessage: last
                    ? {
                          ...this.serializeMessage(last),
                          isMine: last.senderId === userId,
                      }
                    : null,
                unreadCount: unreadMap.get(c.id) ?? 0,
                isTyping: false,
                isHalalVerified: partnerUser.profile?.isVerified ?? false,
                waliInvolved: c.waliInvolved,
            };
        });
    }

    // ── Assert membership + return conversation row ──────────────
    private async assertMembership(userId: string, conversationId: string) {
        const conv = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!conv) throw new NotFoundException('Conversation not found');
        if (conv.userAId !== userId && conv.userBId !== userId) {
            throw new ForbiddenException('Not a participant in this conversation');
        }
        return conv;
    }

    // ── Paginated message history ───────────────────────────────
    async getMessages(
        userId: string,
        conversationId: string,
        opts: { before?: string; limit?: number },
    ) {
        await this.assertMembership(userId, conversationId);
        const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
        const where: Prisma.MessageWhereInput = {
            conversationId,
            ...(opts.before && { createdAt: { lt: new Date(opts.before) } }),
        };
        const rows = await this.prisma.message.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return rows
            .reverse() // return oldest → newest
            .map((m) => ({
                ...this.serializeMessage(m),
                isMine: m.senderId === userId,
            }));
    }

    // ── Send ────────────────────────────────────────────────────
    async sendMessage(
        userId: string,
        conversationId: string,
        text: string,
        opts: { type?: string; mediaUrl?: string } = {},
    ) {
        const conv = await this.assertMembership(userId, conversationId);
        const type = opts.type ?? 'text';

        // Photo/voice messages are a premium feature (Module C). Text is free.
        if (type !== 'text') {
            if (!opts.mediaUrl) {
                throw new BadRequestException('mediaUrl is required for media messages');
            }
            const sender = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { plan: true },
            });
            if (!sender || sender.plan === 'basic') {
                throw new ForbiddenException(
                    'Photo and voice messages are a Premium feature.',
                );
            }
        }

        const clean = text.trim();
        if (type === 'text' && !clean) {
            throw new BadRequestException('Message cannot be empty');
        }

        // Auto-moderation: flag (don't block) text that hits the word list.
        const flagged = type === 'text' && containsFlaggedWord(clean);

        const msg = await this.prisma.$transaction(async (tx) => {
            const m = await tx.message.create({
                data: {
                    conversationId,
                    senderId: userId,
                    text: clean,
                    type,
                    mediaUrl: opts.mediaUrl ?? null,
                    flagged,
                },
            });
            await tx.conversation.update({
                where: { id: conversationId },
                data: { lastMessageAt: m.createdAt },
            });
            return m;
        });

        const other = conv.userAId === userId ? conv.userBId : conv.userAId;
        const payload = {
            ...this.serializeMessage(msg),
            isMine: false, // false because it's serialized for the *other* user
        };
        this.bus.emitToConversation(conversationId, 'message:new', payload);
        this.bus.emitToUser(other, 'conversation:bump', { conversationId });
        this.bus.emitToUser(other, 'notification:new', { kind: 'message', conversationId });
        if (flagged) {
            // Surfaced to moderation tooling; the peer still receives the message.
            this.bus.emitToConversation(conversationId, 'message:flagged', {
                conversationId,
                messageId: msg.id,
            });
            // Live admin feed — flagged content is moderation-relevant.
            this.bus.emitAdminEvent('message', 'Flagged message in a conversation', {
                conversationId,
                messageId: msg.id,
            });
        }

        return { ...this.serializeMessage(msg), isMine: true };
    }

    // ── Read receipts ───────────────────────────────────────────
    // Always mark messages read (for unread counts), but only emit a read
    // receipt to the peer when the reader is Premium AND has read-receipts on
    // (Module C: "Read receipts (premium toggle)").
    async markRead(userId: string, conversationId: string) {
        await this.assertMembership(userId, conversationId);
        const now = new Date();
        const res = await this.prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: userId },
                readAt: null,
            },
            data: { readAt: now },
        });

        const reader = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true, readReceiptsEnabled: true },
        });
        const receiptsOn =
            !!reader && reader.plan !== 'basic' && reader.readReceiptsEnabled;

        if (res.count > 0 && receiptsOn) {
            this.bus.emitToConversation(conversationId, 'message:read', {
                conversationId,
                readerId: userId,
                readAt: now,
            });
        }
        return { count: res.count, receiptsShared: receiptsOn };
    }

    // ── Involve wali ────────────────────────────────────────────
    /// CCs the sender's guardian on a summary of the conversation and marks the
    /// chat as wali-involved. Guardian delivery (email/SMS) is logged in dev;
    /// wire a mailer/SMS provider for production.
    async involveWali(userId: string, conversationId: string) {
        await this.assertMembership(userId, conversationId);
        const profile = await this.prisma.profile.findUnique({
            where: { userId },
            select: { waliName: true, waliEmail: true, waliPhone: true },
        });
        if (!profile?.waliName || (!profile.waliEmail && !profile.waliPhone)) {
            throw new BadRequestException(
                'Add a guardian (wali) contact in your profile first.',
            );
        }

        const recentCount = await this.prisma.message.count({
            where: { conversationId },
        });

        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: { waliInvolved: true, waliInvolvedAt: new Date() },
        });

        // eslint-disable-next-line no-console
        console.log(
            `📧 [wali] Summary for conversation ${conversationId} (${recentCount} messages) ` +
                `CC'd to ${profile.waliName} <${profile.waliEmail ?? profile.waliPhone}>`,
        );

        this.bus.emitToConversation(conversationId, 'wali:involved', {
            conversationId,
        });
        return { success: true, waliInvolved: true };
    }

    // ── Typing pass-through ─────────────────────────────────────
    async broadcastTyping(userId: string, conversationId: string, typing: boolean) {
        await this.assertMembership(userId, conversationId);
        this.bus.emitToConversation(conversationId, 'typing', {
            conversationId,
            userId,
            typing,
        });
    }
}
