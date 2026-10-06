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
