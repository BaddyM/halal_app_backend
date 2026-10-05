import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WaliController } from './wali.controller';
import { WaliService } from './wali.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';

describe('WaliController contract aliases', () => {
  let controller: WaliController;
  const waliService = {
    getMyWalis: jest.fn(),
    revokeWali: jest.fn(),
    updateWaliPermissions: jest.fn(),
  } as unknown as jest.Mocked<Pick<WaliService, 'getMyWalis' | 'revokeWali' | 'updateWaliPermissions'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaliController],
      providers: [
        { provide: WaliService, useValue: waliService },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: RealtimeBus, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();

    controller = module.get<WaliController>(WaliController);
    jest.clearAllMocks();
  });

  it('supports the app-level GET /wali alias', async () => {
    const result = [{ linkId: 'l1', status: 'active' }];
    waliService.getMyWalis.mockResolvedValue(result as any);

    await expect(controller.listAliases({ user: { id: 'user-1' } } as any)).resolves.toEqual(result);
    expect(waliService.getMyWalis).toHaveBeenCalledWith('user-1');
  });

  it('supports PATCH /wali/preferences by mapping app fields to storage fields', async () => {
    const result = { linkId: 'l1', status: 'active' };
    waliService.updateWaliPermissions.mockResolvedValue(result as any);

    await expect(
      controller.updatePreferences({ user: { id: 'user-1' } } as any, { ccChats: true, weeklySummary: true, matchApprovals: true }),
    ).resolves.toEqual(result);

    expect(waliService.updateWaliPermissions).toHaveBeenCalledWith('user-1', 'l1', {
      seeChats: true,
      approveMatches: true,
    });
  });

  it('supports DELETE /wali/:id for revoking a wali link', async () => {
    const result = { linkId: 'l1', status: 'revoked' };
    waliService.revokeWali.mockResolvedValue(result as any);

    await expect(controller.deleteAlias({ user: { id: 'user-1' } } as any, 'l1')).resolves.toEqual(result);
    expect(waliService.revokeWali).toHaveBeenCalledWith('user-1', 'l1');
  });
});
