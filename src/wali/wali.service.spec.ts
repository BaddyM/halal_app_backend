import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { WaliService } from './wali.service';

describe('WaliService weekly email privacy', () => {
  it('does not include chat excerpts when the member has not enabled chat sharing', async () => {
    const link = {
      id: 'link-1',
      userId: 'user-1',
      waliId: 'wali-1',
      status: 'active',
      weeklyDigest: true,
      seeChats: false,
      chatSummaries: true,
      matchAlerts: false,
      user: { id: 'user-1', name: 'Member' },
      wali: { id: 'wali-1', email: 'wali@example.com' },
    };
    const prisma = {
      appSetting: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { key: 'wali.ccDigestFrequency', value: 'weekly' },
          ]),
      },
      waliLink: { findMany: jest.fn().mockResolvedValue([link]) },
      waliDigest: { findUnique: jest.fn().mockResolvedValue(null) },
      message: { findMany: jest.fn() },
    };
    const mail = { sendWaliSummary: jest.fn() };
    const service = new WaliService(
      prisma as unknown as PrismaService,
      {} as RealtimeBus,
      mail as unknown as MailService,
      {} as ConfigService,
    );

    await service.sendWeeklyDigests();

    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(mail.sendWaliSummary).not.toHaveBeenCalled();
  });

  it('keeps dashboard chat-sharing and digest permissions in sync', async () => {
    const tx = {
      waliLink: { update: jest.fn().mockResolvedValue({ id: 'link-1' }) },
    };
    const prisma = {
      waliLink: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'link-1', userId: 'user-1' }),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new WaliService(
      prisma as unknown as PrismaService,
      {} as RealtimeBus,
      {} as MailService,
      {} as ConfigService,
    );

    await service.updateDashboardLink('link-1', { ccChats: false });

    expect(tx.waliLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seeChats: false,
          chatSummaries: false,
        }),
      }),
    );
  });
});

describe('WaliService member policies', () => {
  function serviceWith(prisma: any) {
    return new WaliService(
      prisma as PrismaService,
      {} as RealtimeBus,
      {} as MailService,
      {} as ConfigService,
    );
  }

  it('limits member-side Wali settings to female members', async () => {
    const prisma = {
      appSetting: { findMany: jest.fn().mockResolvedValue([]) },
      profile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ gender: 'male', waliEnabled: true }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.assertMemberFeatureEnabled('male-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getMemberFeatureState('male-user'),
    ).resolves.toMatchObject({
      eligible: false,
      enabled: false,
      globalEnabled: true,
    });
  });

  it('does not require an active Wali after a female member opts out', async () => {
    const prisma = {
      appSetting: { findMany: jest.fn().mockResolvedValue([]) },
      profile: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'female-user', gender: 'female', waliEnabled: false },
          ]),
      },
      waliLink: { count: jest.fn() },
    };
    const service = serviceWith(prisma);

    await expect(
      service.assertChatAllowed(['female-user']),
    ).resolves.toBeUndefined();
    expect(prisma.waliLink.count).not.toHaveBeenCalled();
  });

  it('uses a conditional update so only one invitation response can succeed', async () => {
    const prisma = {
      appSetting: { findMany: jest.fn().mockResolvedValue([]) },
      profile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ gender: 'female', waliEnabled: true }),
      },
      waliLink: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'link-1',
          userId: 'member-1',
          waliId: 'wali-1',
          status: 'pending',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.respondToInvitation('wali-1', 'link-1', { action: 'accept' }),
    ).rejects.toThrow('Link already responded to');
    expect(prisma.waliLink.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link-1', waliId: 'wali-1', status: 'pending' },
      }),
    );
  });
});
