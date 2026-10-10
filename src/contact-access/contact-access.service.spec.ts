import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { ContactAccessService } from './contact-access.service';

const activeUser = {
  isActive: true,
  status: 'active',
};

function serviceWith(overrides: Record<string, any> = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'requester' }]),
    user: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.id === 'requester'
              ? {
                  id: 'requester',
                  name: 'Requester',
                  plan: 'basic',
                  planExpiresAt: null,
                  ...activeUser,
                }
              : {
                  id: 'recipient',
                  name: 'Recipient',
                  profileVisibility: 'everyone',
                  ...activeUser,
                },
          ),
        ),
    },
    contactAccessRequest: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'request-1' }),
    },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    match: { findUnique: jest.fn().mockResolvedValue({ id: 'match-1' }) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        plan: 'basic',
        planExpiresAt: null,
      }),
    },
    contactAccessRequest: {
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    match: { findUnique: jest.fn().mockResolvedValue({ id: 'match-1' }) },
    ...overrides,
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  return { service: new ContactAccessService(prisma as any, config as any, push as any), prisma, tx, config, push };
}

describe('ContactAccessService', () => {
  it('creates a free request within the daily limit and locks the requester row', async () => {
    const { service, tx, push } = serviceWith();

    const result = await service.create('requester', 'recipient');

    expect(result.request.status).toBe('pending');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.contactAccessRequest.create).toHaveBeenCalled();
    expect(push.sendToUser).toHaveBeenCalledWith(
      'recipient',
      expect.objectContaining({
        data: { type: 'contact_access_request', requestId: 'request-1' },
      }),
    );
  });

  it('enforces the one-request free daily allowance inside the locked transaction', async () => {
    const { service, tx } = serviceWith();
    tx.contactAccessRequest.count.mockResolvedValue(1);

    try {
      await service.create('requester', 'recipient');
      fail('Expected the daily request limit to reject the request');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(429);
      }
    }
    expect(tx.contactAccessRequest.create).not.toHaveBeenCalled();
  });

  it('uses the configured higher allowance for active Premium users', async () => {
    const { service, prisma, config } = serviceWith({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'premium',
          planExpiresAt: null,
        }),
      },
    });
    prisma.contactAccessRequest.findUnique.mockResolvedValue(null);
    config.get.mockReturnValue('8');

    const result = await service.status('requester', 'recipient');

    expect(result.quota.limit).toBe(8);
  });

  it('rejects blocked pairs before creating a request', async () => {
    const { service, tx } = serviceWith();
    tx.block.findFirst.mockResolvedValue({ id: 'block-1' });

    await expect(service.create('requester', 'recipient')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.contactAccessRequest.create).not.toHaveBeenCalled();
  });

  it('rejects repeated requests after a prior decision', async () => {
    const { service, tx } = serviceWith();
    tx.contactAccessRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      status: 'declined',
    });

    await expect(service.create('requester', 'recipient')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects decisions from anyone other than the recipient', async () => {
    const { service, prisma } = serviceWith();
    prisma.contactAccessRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      requesterId: 'requester',
      recipientId: 'recipient',
      status: 'pending',
      requester: activeUser,
      recipient: activeUser,
    });

    await expect(
      service.decide('intruder', 'request-1', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.contactAccessRequest.updateMany).not.toHaveBeenCalled();
  });

  it('only returns a verified phone after approval', async () => {
    const { service, tx } = serviceWith();
    tx.contactAccessRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      requesterId: 'requester',
      recipientId: 'recipient',
      status: 'approved',
      requester: { id: 'requester', ...activeUser },
      recipient: {
        id: 'recipient',
        phone: '+256700000000',
        isPhoneVerified: true,
        profileVisibility: 'everyone',
        ...activeUser,
      },
    });

    await expect(service.phone('requester', 'request-1')).resolves.toEqual({
      phone: '+256700000000',
    });
  });

  it('does not return contact details for a request that is not approved', async () => {
    const { service, tx } = serviceWith();
    tx.contactAccessRequest.findUnique.mockResolvedValue({
      requesterId: 'requester',
      recipientId: 'recipient',
      status: 'pending',
    });

    await expect(service.phone('requester', 'request-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
