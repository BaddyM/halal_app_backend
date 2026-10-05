import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '../auth/auth.guard';

describe('MatchesController', () => {
  let controller: MatchesController;

  const usersService = {
    matchesByStatus: jest.fn(),
    matchesSummary: jest.fn(),
    compatibilityWith: jest.fn(),
    acceptInterest: jest.fn(),
    rejectInterest: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<UsersService, 'matchesByStatus' | 'matchesSummary' | 'compatibilityWith' | 'acceptInterest' | 'rejectInterest'>
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      // The controller is guarded by AuthGuard, which pulls in JwtService,
      // PrismaService and RealtimeBus. This test drives the handler directly,
      // so stub the guard rather than standing up its whole dependency tree.
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MatchesController>(MatchesController);
    jest.clearAllMocks();
  });

  it('returns a matching summary for the authenticated user', async () => {
    const summary = { pendingCount: 2, acceptedCount: 1, pending: [], accepted: [] };
    usersService.matchesSummary.mockResolvedValue(summary);

    await expect(
      controller.summary({ user: { userId: 'user-1' } } as any),
    ).resolves.toEqual(summary);

    expect(usersService.matchesSummary).toHaveBeenCalledWith('user-1');
  });
});
