import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { SmsService } from '../mail/sms.service';

describe('AuthService', () => {
  let service: AuthService;
  let mailService: { sendCodeEmail: jest.Mock };
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    emailVerificationToken: { create: jest.Mock };
    refreshToken: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mailService = { sendCodeEmail: jest.fn().mockResolvedValue({}) };
    prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', email: 'user@example.com', profile: {} }),
      },
      emailVerificationToken: { create: jest.fn().mockResolvedValue({}) },
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
});
