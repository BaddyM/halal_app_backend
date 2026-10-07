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
});
