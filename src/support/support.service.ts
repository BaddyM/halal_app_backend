import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiService } from 'src/chat/ai.service';
import { CreateSupportTicketDto, ReplySupportTicketDto, UpdateSupportTicketDto } from './dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService) {}

  private serialize(ticket: any) {
    return {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      messages: (ticket.messages ?? []).map((message: any) => ({
        id: message.id,
        body: message.body,
        fromAdmin: message.fromAdmin,
        createdAt: message.createdAt,
      })),
    };
  }

  async listForUser(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return tickets.map((ticket) => this.serialize(ticket));
  }

  async create(userId: string, dto: CreateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject,
        category: dto.category ?? 'general',
        priority: dto.priority ?? 'normal',
        messages: { create: { body: dto.body, fromAdmin: false } },
      },
      include: { messages: true },
    });
    return this.serialize(ticket);
  }

  async replyForUser(userId: string, ticketId: string, dto: ReplySupportTicketDto) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    await this.prisma.supportTicketMessage.create({
      data: { ticketId, body: dto.body, fromAdmin: false },
    });
    await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'open' } });
    return this.getForUser(userId, ticketId);
  }

  async getForUser(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return this.serialize(ticket);
  }

  async listForAdmin(status?: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'asc' } } },
    });
    return tickets.map((ticket) => ({ ...this.serialize(ticket), user: ticket.user }));
  }

  async updateForAdmin(ticketId: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { ...(dto.status !== undefined && { status: dto.status }), ...(dto.priority !== undefined && { priority: dto.priority }) },
      include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'asc' } } },
    });
    return { ...this.serialize(ticket), user: ticket.user };
  }

  async replyForAdmin(ticketId: string, dto: ReplySupportTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    await this.prisma.supportTicketMessage.create({ data: { ticketId, body: dto.body, fromAdmin: true } });
    await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'waitingForUser' } });
    return this.getAdmin(ticketId);
  }

  async getAdmin(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return { ...this.serialize(ticket), user: ticket.user };
  }

  async askAi(userId: string, body: string, ticketId?: string) {
    let ticket = ticketId
      ? await this.prisma.supportTicket.findFirst({ where: { id: ticketId, userId, category: 'ai' } })
      : await this.prisma.supportTicket.findFirst({ where: { userId, category: 'ai', status: { not: 'closed' } }, orderBy: { updatedAt: 'desc' } });
    if (!ticket) {
      ticket = await this.prisma.supportTicket.create({
        data: { userId, subject: 'AI Support', category: 'ai', priority: 'normal' },
      });
    }
    await this.prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, body, fromAdmin: false } });
    const history = await this.prisma.supportTicketMessage.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: 'asc' }, take: 12 });
    const userQuestionCount = history.filter((item) => !item.fromAdmin).length;
    const greeting = /^(hi|hello|hey|salam|assalamu alaikum)\b/i.test(body.trim());
    const result = greeting
      ? {
          reply: 'Wa alaikum assalam. Welcome to Halal Connect support. How can I help you today?',
          escalate: false,
        }
      : userQuestionCount > 6
          ? {
              reply: 'I have shared this conversation with our support handler. They will reply soon, so there is no need to send more messages for now.',
              escalate: true,
            }
          : await this.ai.analyzeAndReply(body, {
              supportTicketId: ticket.id,
              history: history.map((item) => ({ fromAdmin: item.fromAdmin, body: item.body })),
            });
    const unavailable = result.reply.toLowerCase().includes('ai is not configured') ||
      result.reply.toLowerCase().includes('ai is temporarily unavailable') ||
      result.reply.toLowerCase().includes('ai is unavailable');
    const finalResult = unavailable
      ? {
          reply: greeting
            ? 'Wa alaikum assalam. Welcome to Halal Connect support. Please tell us what you need help with. A support handler will reply soon.'
            : 'Thanks for contacting Halal Connect support. I could not answer that automatically, so a support handler will review this conversation and reply soon.',
          escalate: true,
        }
      : result;
    await this.prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, body: finalResult.reply, fromAdmin: true } });
    await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: finalResult.escalate ? 'waitingForUser' : 'open' } });
    return this.getForUser(userId, ticket.id);
  }
}
