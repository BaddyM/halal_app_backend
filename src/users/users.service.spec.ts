import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

function serviceWith(prisma: any) {
  return new UsersService(prisma, {} as any, {} as any, {} as any, {} as any);
}

describe('UsersService subscription authorization', () => {
  it('rejects enabling read receipts for Basic users', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'basic' }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.updateProfile('basic-user', { readReceiptsEnabled: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('UsersService discovery and pass behavior', () => {
    it('does not persist a pass so the profile can be discovered again later', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'target' }) },
        like: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const service = serviceWith(prisma);

      await expect(
        service.likeProfile('viewer', { toUserId: 'target', type: 'pass' }),
      ).resolves.toEqual({ success: true, matched: false });
      expect(prisma.like.deleteMany).toHaveBeenCalledWith({
        where: { fromUserId: 'viewer', toUserId: 'target' },
      });
    });

    it('excludes incognito and non-public profiles from discovery', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'viewer',
            plan: 'basic',
            profile: { gender: 'male' },
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        like: { findMany: jest.fn().mockResolvedValue([]) },
        block: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = serviceWith(prisma);

      await service.discover('viewer', {});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            incognitoMode: false,
            profileVisibility: 'everyone',
          }),
        }),
      );
      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: { fromUserId: 'viewer', type: { in: ['like', 'superLike'] } },
        select: { toUserId: true },
      });
    });
  });

  describe('UsersService profile visibility', () => {
    it.each([
      ['matchesOnly', null],
      ['nobody', { id: 'existing-match' }],
    ])(
      'hides %s profiles when they are not visible to the viewer',
      async (visibility, match) => {
        const prisma = {
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce({
                id: 'viewer',
                plan: 'basic',
                profile: {},
              })
              .mockResolvedValueOnce({
                id: 'target',
                profileVisibility: visibility,
                profile: {},
              }),
          },
          block: { findMany: jest.fn().mockResolvedValue([]) },
          match: { findUnique: jest.fn().mockResolvedValue(match) },
        };
        const service = serviceWith(prisma);

        await expect(
          service.getProfileById('viewer', 'target'),
        ).rejects.toThrow('Profile not found');
      },
    );
  });

  it('does not allow a user to activate a paid plan without verified checkout', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'basic', planExpiresAt: null }),
        update: jest.fn(),
      },
    };
    const service = serviceWith(prisma);

    await expect(service.changePlan('basic-user', 'premium' as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows a request that leaves the current plan unchanged', async () => {
    const currentPlan = { plan: 'premium', planExpiresAt: new Date('2026-11-01T00:00:00Z') };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(currentPlan),
        update: jest.fn(),
      },
    };
    const service = serviceWith(prisma);

    await expect(service.changePlan('paid-user', 'premium' as any))
      .resolves.toEqual(currentPlan);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
