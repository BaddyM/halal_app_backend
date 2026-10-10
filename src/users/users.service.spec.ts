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

  describe('UsersService profile contact privacy', () => {
    it('does not return a matched member phone number from their profile', async () => {
      const target = {
        id: 'target',
        name: 'Member',
        phone: '+256700000000',
        profileVisibility: 'everyone',
        plan: 'basic',
        profile: { gender: 'female' },
        photos: [],
        onboardingAnswers: [],
      };
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'viewer',
              plan: 'basic',
              profile: { gender: 'male' },
            })
            .mockResolvedValueOnce(target),
          update: jest.fn().mockResolvedValue({ profileViews: 1 }),
        },
        block: { findMany: jest.fn().mockResolvedValue([]) },
        match: { findUnique: jest.fn().mockResolvedValue({ id: 'match' }) },
        photoAccessRequest: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = serviceWith(prisma);

      const profile = await service.getProfileById('viewer', 'target');

      expect(profile.phone).toBeUndefined();
    });
  });

  describe('UsersService discovery and pass behavior', () => {
    it('records a true pass distinctly without affecting discovery eligibility', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'target' }) },
        like: { upsert: jest.fn().mockResolvedValue({}) },
      };
      const service = serviceWith(prisma);

      await expect(
        service.likeProfile('viewer', { toUserId: 'target', type: 'pass' }),
      ).resolves.toEqual({ success: true, matched: false });
      expect(prisma.like.upsert).toHaveBeenCalledWith({
        where: {
          fromUserId_toUserId: {
            fromUserId: 'viewer',
            toUserId: 'target',
          },
        },
        update: { type: 'pass' },
        create: { fromUserId: 'viewer', toUserId: 'target', type: 'pass' },
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

    it.each([
      ['male', 'female'],
      ['female', 'male'],
    ])('restricts %s discovery to %s profiles and queries the full pool', async (viewerGender, expectedGender) => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'viewer',
            plan: 'basic',
            profile: { gender: viewerGender },
          }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        like: { findMany: jest.fn().mockResolvedValue([]) },
        block: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = serviceWith(prisma);

      await service.discover('viewer', {});

      const query = prisma.user.findMany.mock.calls[0][0];
      expect(query.where.profile.gender).toBe(expectedGender);
      expect(query).not.toHaveProperty('take');
    });
  });

  it('does not mark an incomplete onboarding submission as complete', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = serviceWith(prisma);

    await expect(
      service.submitOnboarding('user-1', {
        answers: [{ questionId: 'gender', answer: 'Sister' }],
      }),
    ).rejects.toThrow('Onboarding is incomplete');
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
