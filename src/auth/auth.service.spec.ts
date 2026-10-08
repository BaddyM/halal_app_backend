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
      updateMany: jest.Mock;
    };
    appSetting: { findUnique: jest.Mock };
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      emailVerificationToken: { create: jest.fn().mockResolvedValue({}) },
      adminLoginChallenge: {
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((operation: unknown) => {
        if (typeof operation === 'function') return operation(prismaService);
        return Promise.resolve([]);
      }),
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
    await service.signup('Test', 'user@example.com', 'password123', true, '1');

    expect(mailService.sendCodeEmail).toHaveBeenCalledWith('user@example.com', expect.any(String), 'verify');
  });

  it('rejects signup when the user has not accepted the terms', async () => {
    await expect(
      service.signup('Test', 'user@example.com', 'password123', false, '1'),
    ).rejects.toThrow('You must accept the Terms & Conditions to register');
    expect(prismaService.user.create).not.toHaveBeenCalled();
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

  it('locks an account after repeated failed passwords without changing the generic error', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      password: await bcrypt.hash('correct-password', 4),
      isActive: true,
      failedLoginAttempts: 9,
      loginLockedUntil: null,
    };
    prismaService.user.findUnique.mockResolvedValue(user);
    prismaService.user.update.mockResolvedValueOnce({
      failedLoginAttempts: 10,
    });

    await expect(service.login(user.email, 'wrong-password')).rejects.toThrow(
      'Invalid email or password',
    );
    expect(prismaService.$transaction).toHaveBeenCalled();
    expect(prismaService.user.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      }),
    );
    expect(prismaService.user.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: user.id },
        data: { loginLockedUntil: expect.any(Date) },
      }),
    );
    expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects login during a lockout and resets expired lockouts', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      password: await bcrypt.hash('correct-password', 4),
      isActive: true,
      failedLoginAttempts: 10,
      loginLockedUntil: new Date(Date.now() + 60_000),
    };
    prismaService.user.findUnique.mockResolvedValue(user);

    await expect(service.login(user.email, 'correct-password')).rejects.toThrow(
      'Invalid email or password',
    );
    expect(prismaService.user.updateMany).not.toHaveBeenCalled();
    expect(prismaService.refreshToken.create).not.toHaveBeenCalled();

    user.loginLockedUntil = new Date(Date.now() - 60_000);
    const validPasswordUser = {
      ...user,
      password: await bcrypt.hash('correct-password', 4),
    };
    prismaService.user.findUnique.mockResolvedValue(validPasswordUser);
    await service.login(validPasswordUser.email, 'correct-password');

    expect(prismaService.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: user.id }),
        data: { failedLoginAttempts: 0, loginLockedUntil: null },
      }),
    );
    expect(prismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          loginLockedUntil: null,
        }),
      }),
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
