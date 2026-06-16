import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeBus,
  ) {}

  /// Inbox list: root admin messages (threads) newest-first, with a preview and
  /// unread flag. Replies are nested under their thread (fetched via getOne).
  async list(userId: string) {
    const messages = await this.prisma.inboxMessage.findMany({
      where: { userId, parentId: null },
      orderBy: { createdAt: 'desc' },
    });
    return messages.map((m) => ({
      id: m.id,
      subject: m.subject ?? 'Message from Halal Connect',
      preview: m.body.length > 120 ? `${m.body.slice(0, 120)}…` : m.body,
      isRead: m.isRead,
      fromAdmin: m.fromAdmin,
      createdAt: m.createdAt,
    }));
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.inboxMessage.count({
      where: { userId, fromAdmin: true, isRead: false },
    });
    return { count };
  }

  /// A thread: the root message plus its replies in chronological order.
  async getOne(userId: string, id: string) {
    const root = await this.prisma.inboxMessage.findFirst({
      where: { id, userId },
    });
    if (!root) throw new NotFoundException('Message not found');

    const replies = await this.prisma.inboxMessage.findMany({
      where: { parentId: id },
      orderBy: { createdAt: 'asc' },
    });

    const serialize = (m: typeof root) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      fromAdmin: m.fromAdmin,
      isRead: m.isRead,
      createdAt: m.createdAt,
    });

    return {
      ...serialize(root),
      replies: replies.map(serialize),
    };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.inboxMessage.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  /// User replies to an admin thread. The reply is stored under the root and
  /// surfaces in the dashboard messaging tool.
  async reply(userId: string, id: string, body: string) {
    const root = await this.prisma.inboxMessage.findFirst({
      where: { id, userId, parentId: null },
    });
    if (!root) throw new NotFoundException('Thread not found');

    const reply = await this.prisma.inboxMessage.create({
      data: {
        userId,
        parentId: id,
        fromAdmin: false,
        body,
        // Unread from the admin's perspective until they open the thread.
        isRead: false,
      },
    });

    // Surface the reply live in the admin dashboard feed.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    this.realtime.emitAdminEvent('message', `${user?.name ?? 'A user'} replied to support`, {
      userId,
      support: true,
    });

    return {
      id: reply.id,
      body: reply.body,
      fromAdmin: false,
      createdAt: reply.createdAt,
    };
  }
}
