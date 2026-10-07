import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { SmsService } from '../mail/sms.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mailService: {
    sendCodeEmail: jest.Mock;
    sendAdminLoginCode: jest.Mock;
  };
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    emailVerificationToken: { create: jest.Mock };
    adminLoginChallenge: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    refreshToken: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mailService = {
      sendCodeEmail: jest.fn().mockResolvedValue({}),
      sendAdminLoginCode: jest.fn().mockResolvedValue({}),
    };
    prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', email: 'user@example.com', profile: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
      emailVerificationToken: { create: jest.fn().mockResolvedValue({}) },
      adminLoginChallenge: {
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => (key === 'MODE' ? 'Dev' : undefined)) } },
        { provide: OAuthService, useValue: {} },
        { provide: RealtimeBus, useValue: { emitAdminEvent: jest.fn() } },
        { provide: MailService, useValue: mailService },
        { provide: SmsService, useValue: { sendCode: jest.fn(), sendMessage: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('sends a verification email when a user signs up', async () => {
    await service.signup('Test', 'user@example.com', 'password123');

    expect(mailService.sendCodeEmail).toHaveBeenCalledWith('user@example.com', expect.any(String), 'verify');
  });

  it('requires an emailed one-time code before creating admin tokens', async () => {
    const admin = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      password: await bcrypt.hash('correct-password', 4),
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
      profile: null,
    };
    prismaService.user.findUnique.mockResolvedValue(admin);

    const result = await service.login(admin.email, 'correct-password');

    expect(result).toMatchObject({
      requiresAdminOtp: true,
      challengeId: 'challenge-1',
    });
    expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
    expect(mailService.sendAdminLoginCode).toHaveBeenCalledWith(
      admin.email,
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('consumes a valid admin code once before issuing tokens', async () => {
    const code = '123456';
    const admin = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      password: 'hashed',
      role: 'admin',
      isActive: true,
    };
    prismaService.adminLoginChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: admin.id,
      user: admin,
      codeHash: await bcrypt.hash(code, 4),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    const result = await service.verifyAdminLogin('challenge-1', code);

    expect(result).toMatchObject({
      user: { id: admin.id, role: 'admin' },
      accessToken: 'token',
      refreshToken: expect.any(String),
    });
    expect(prismaService.adminLoginChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'challenge-1', usedAt: null }),
        data: { usedAt: expect.any(Date) },
      }),
    );
    expect(prismaService.refreshToken.create).toHaveBeenCalledTimes(1);
  });
});
