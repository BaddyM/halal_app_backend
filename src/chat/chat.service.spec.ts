import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

function serviceWith(prisma: any) {
  return new ChatService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('ChatService authorization', () => {
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
});
