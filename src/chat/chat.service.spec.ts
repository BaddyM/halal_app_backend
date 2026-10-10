import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

function serviceWith(
  prisma: any,
  wali?: any,
  ai: any = {},
  bus: any = {},
  push: any = {},
) {
  return new ChatService(
    prisma,
    bus,
    ai,
    push,
    {} as any,
    {} as any,
    wali ??
      ({
        assertChatAllowed: jest.fn().mockResolvedValue(undefined),
        sendInstantMessageSummary: jest.fn(),
      } as any),
  );
}

describe('ChatService authorization', () => {
  it('answers safe bot questions using the actual user message and fixed topic context', async () => {
    const question = 'How do I turn on prayer alerts?';
    const ai = {
      analyzeAndReply: jest.fn().mockResolvedValue({
        reply: 'Open notification settings to enable prayer alerts.',
        escalate: false,
      }),
    };
    const service = serviceWith({}, undefined, ai);

    const result = await (service as any).replyToBotMessage(
      'user-1',
      'conversation-1',
      question,
    );

    expect(ai.analyzeAndReply).toHaveBeenCalledWith(question, {
      topic: 'prayer times and prayer alerts',
      scope: 'general app support',
    });
    expect(result.reply).toContain('Open notification settings');
  });

  it('routes unsupported bot questions to support without creating a user report', async () => {
    const question = 'My payment failed; can you check it?';
    const ticketCreate = jest.fn().mockResolvedValue({ id: 'ticket-1' });
    const ai = { analyzeAndReply: jest.fn() };
    const bus = { emitAdminEvent: jest.fn() };
    const service = serviceWith(
      { supportTicket: { create: ticketCreate } },
      undefined,
      ai,
      bus,
    );

    const result = await (service as any).replyToBotMessage(
      'user-1',
      'conversation-1',
      question,
    );

    expect(ai.analyzeAndReply).not.toHaveBeenCalled();
    expect(ticketCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        subject: 'In-app AI support follow-up',
        category: 'ai',
        priority: 'normal',
        messages: { create: { body: question, fromAdmin: false } },
      },
      select: { id: true },
    });
    expect(result.reply).toContain('ticket-1');
    expect(bus.emitAdminEvent).toHaveBeenCalledWith(
      'message',
      'AI support follow-up requested',
      expect.objectContaining({ ticketId: 'ticket-1', userId: 'user-1' }),
    );
  });

  it('routes safe questions to support when AI is unavailable', async () => {
    const question = 'How do I turn on prayer alerts?';
    const ticketCreate = jest.fn().mockResolvedValue({ id: 'ticket-2' });
    const ai = {
      analyzeAndReply: jest.fn().mockResolvedValue({
        reply: 'Sorry, AI is not configured.',
        escalate: false,
      }),
    };
    const service = serviceWith(
      { supportTicket: { create: ticketCreate } },
      undefined,
      ai,
      { emitAdminEvent: jest.fn() },
    );

    const result = await (service as any).replyToBotMessage(
      'user-1',
      'conversation-1',
      question,
    );

    expect(ticketCreate).toHaveBeenCalled();
    expect(result.reply).toContain('sent your question to Support');
  });

  it('does not send /bot commands twice in direct bot conversations', async () => {
    const sentMessage = {
      id: 'user-message',
      conversationId: 'conversation-1',
      senderId: 'user-1',
      text: '/bot How do I turn on prayer alerts?',
      createdAt: new Date(),
    };
    const botMessage = {
      id: 'bot-message',
      conversationId: 'conversation-1',
      senderId: 'bot-user',
      text: 'Open notification settings to enable prayer alerts.',
      createdAt: new Date(),
    };
    const txMessageCreate = jest.fn().mockResolvedValue(sentMessage);
    const botMessageCreate = jest.fn().mockResolvedValue(botMessage);
    const ai = {
      analyzeAndReply: jest.fn().mockResolvedValue({
        reply: botMessage.text,
        escalate: false,
      }),
    };
    const bus = {
      emitToConversation: jest.fn(),
      emitToUser: jest.fn(),
      emitAdminEvent: jest.fn(),
    };
    const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    const service = serviceWith(
      {
        conversation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conversation-1',
            userAId: 'user-1',
            userBId: 'bot-user',
            waliInvolved: false,
          }),
        },
        $transaction: jest.fn((work: (tx: any) => Promise<unknown>) =>
          work({
            message: { create: txMessageCreate },
            conversation: { update: jest.fn().mockResolvedValue({}) },
          }),
        ),
        message: { create: botMessageCreate },
        user: {
          findUnique: jest.fn().mockImplementation(({ where }: any) =>
            Promise.resolve(
              where.id === 'user-1' ? { name: 'Member' } : { name: 'Bot' },
            ),
          ),
        },
      },
      undefined,
      ai,
      bus,
      push,
    );
    (service as any).botUserId = 'bot-user';

    await service.sendMessage(
      'user-1',
      'conversation-1',
      '/bot How do I turn on prayer alerts?',
    );

    expect(txMessageCreate).toHaveBeenCalledTimes(1);
    expect(botMessageCreate).toHaveBeenCalledTimes(1);
    expect(ai.analyzeAndReply).toHaveBeenCalledTimes(1);
  });

  it('rejects image and voice messages for a Basic user', async () => {
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conversation-1',
          userAId: 'basic-user',
          userBId: 'other-user',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'basic' }),
      },
    };

    const service = serviceWith(prisma);

    await expect(
      service.sendMessage('basic-user', 'conversation-1', '', {
        type: 'image',
        mediaUrl: '/uploads/photos/chat/image.jpg',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'basic-user' },
      select: { plan: true },
    });
  });

  it('rejects reads and sends from users outside a conversation', async () => {
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conversation-1',
          userAId: 'member-a',
          userBId: 'member-b',
        }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.getMessages('outsider', 'conversation-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.sendMessage('outsider', 'conversation-1', 'hello'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks loading a conversation until the Wali gate is satisfied', async () => {
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conversation-1',
          userAId: 'female-user',
          userBId: 'partner',
        }),
      },
      message: { findMany: jest.fn() },
    };
    const wali = {
      assertChatAllowed: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('active Wali required')),
      sendInstantMessageSummary: jest.fn(),
    };
    const service = serviceWith(prisma, wali);

    await expect(
      service.getMessages('female-user', 'conversation-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('does not resend Wali notifications when involvement is already enabled', async () => {
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conversation-1',
          userAId: 'member-a',
          userBId: 'member-b',
          waliInvolved: true,
        }),
      },
      profile: { findUnique: jest.fn() },
      waliLink: { findFirst: jest.fn() },
    };
    const mail = { sendWaliSummary: jest.fn() };
    const sms = { sendMessage: jest.fn() };
    const service = new ChatService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      mail as any,
      sms as any,
      {
        assertChatAllowed: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    await expect(
      service.involveWali('member-a', 'conversation-1'),
    ).resolves.toMatchObject({
      success: true,
      waliInvolved: true,
      alreadyInvolved: true,
    });
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    expect(mail.sendWaliSummary).not.toHaveBeenCalled();
    expect(sms.sendMessage).not.toHaveBeenCalled();
  });
});
