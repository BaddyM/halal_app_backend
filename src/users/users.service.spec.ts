import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

function serviceWith(prisma: any) {
  return new UsersService(prisma, {} as any, {} as any, {} as any);
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
});
