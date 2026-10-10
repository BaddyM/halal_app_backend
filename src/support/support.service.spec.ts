import { SupportService } from './support.service';

describe('SupportService admin ticket lifecycle', () => {
  const ticket = {
    id: 'ticket-1',
    userId: 'user-1',
    guestName: null,
    guestEmail: null,
    subject: 'Need help',
    category: 'account',
    priority: 'normal',
    status: 'closed',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-1', name: 'Member', email: 'member@example.com' },
    messages: [
      {
        id: 'message-1',
        body: 'Please help',
        fromAdmin: false,
        createdAt: new Date(),
      },
    ],
  };

  it('persists reply-and-close as closed', async () => {
    const prisma = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue(ticket),
        update: jest.fn().mockResolvedValue(ticket),
        findMany: jest.fn(),
      },
      supportTicketMessage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SupportService(prisma as never, {} as never);

    const result = await service.replyForAdmin('ticket-1', {
      body: 'We have resolved this.',
      close: true,
    });

    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { status: 'closed' },
    });
    expect(result.status).toBe('closed');
  });

  it('includes closed and resolved tickets in the closed filter', async () => {
    const prisma = {
      supportTicket: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new SupportService(prisma as never, {} as never);

    await service.listForAdmin('closed');

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['resolved', 'closed'] } },
      }),
    );
  });

  it('sends a safe general-support question to AI for an answer', async () => {
    const question = 'How do I turn on prayer alerts?';
    const ticket = { id: 'ai-ticket-1' };
    const prisma = {
      supportTicket: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            ...ticket,
            userId: 'user-1',
            subject: 'AI Support',
            category: 'ai',
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [
              { id: 'q', body: question, fromAdmin: false, createdAt: new Date() },
              {
                id: 'a',
                body: 'Open notification settings and enable prayer alerts.',
                fromAdmin: true,
                createdAt: new Date(),
              },
            ],
          }),
        create: jest.fn().mockResolvedValue(ticket),
        update: jest.fn().mockResolvedValue({}),
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([
          { body: question, fromAdmin: false },
        ]),
      },
    };
    const ai = {
      analyzeAndReply: jest.fn().mockResolvedValue({
        reply: 'Open notification settings and enable prayer alerts.',
        escalate: false,
      }),
    };
    const service = new SupportService(prisma as never, ai as never);

    await service.askAi('user-1', question);

    expect(ai.analyzeAndReply).toHaveBeenCalledWith(question, {
      topic: 'prayer times and prayer alerts',
      scope: 'general app support',
    });
  });

  it('does not send payment questions to AI and escalates them to a handler', async () => {
    const ticket = { id: 'ai-ticket-1' };
    const prisma = {
      supportTicket: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            ...ticket,
            userId: 'user-1',
            subject: 'AI Support',
            category: 'ai',
            status: 'waitingForUser',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
          }),
        create: jest.fn().mockResolvedValue(ticket),
        update: jest.fn().mockResolvedValue({}),
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([
          { body: 'My payment failed, can you check it?', fromAdmin: false },
        ]),
      },
    };
    const ai = { analyzeAndReply: jest.fn() };
    const service = new SupportService(prisma as never, ai as never);

    await service.askAi('user-1', 'My payment failed, can you check it?');

    expect(ai.analyzeAndReply).not.toHaveBeenCalled();
    expect(prisma.supportTicketMessage.create).toHaveBeenLastCalledWith({
      data: {
        ticketId: ticket.id,
        body: 'For your privacy, this message was not sent to the AI assistant. A support handler will review your request and reply here.',
        fromAdmin: true,
      },
    });
  });
});
