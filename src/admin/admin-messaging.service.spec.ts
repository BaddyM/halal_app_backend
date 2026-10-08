import { AdminMessagingService } from './admin-messaging.service';

describe('AdminMessagingService broadcast notifications', () => {
  it('stores a recipient-scoped feed item without creating a support inbox message', async () => {
    const prisma = {
      broadcast: {
        create: jest.fn().mockResolvedValue({ id: 'broadcast-1' }),
      },
      inboxMessage: { createMany: jest.fn() },
    };
    const realtime = {
      broadcast: jest.fn(),
      emitToUser: jest.fn(),
    };
    const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminMessagingService(
      prisma as never,
      push as never,
      realtime as never,
    );

    const result = await service.broadcast(
      'Service update',
      'A short update for one member.',
      undefined,
      ['user-1'],
    );

    expect(result).toEqual({ sent: 1 });
    expect(prisma.broadcast.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Service update',
        audience: 'selected',
        reach: 1,
        recipients: { createMany: { data: [{ userId: 'user-1' }] } },
      }),
    });
    expect(prisma.inboxMessage.createMany).not.toHaveBeenCalled();
    expect(realtime.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'notification:new',
      {
        kind: 'broadcast',
        broadcastId: 'broadcast-1',
      },
    );
  });
});
