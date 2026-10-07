import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('sends admin sign-in codes through Resend when configured', async () => {
    const values: Record<string, string> = {
      MAIL_HOST: 'smtp.gmail.com',
      MAIL_USER: 'sender@example.com',
      MAIL_PASS: 'app-password',
      RESEND_API_KEY: 'test-key',
      RESEND_FROM: 'Halal Connect <team@halalconnect.space>',
      MODE: 'Prod',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    const service = new MailService(config);
    const sendResendMail = jest
      .spyOn(service, 'sendResendMail')
      .mockResolvedValue({ id: 'test-email-id' });

    await service.sendAdminLoginCode('admin@example.com', '123456');

    expect(sendResendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Halal Connect admin sign-in code',
      }),
    );
  });

  it('uses the authenticated SMTP account when MAIL_FROM is empty', async () => {
    const sendMail = jest
      .fn()
      .mockResolvedValue({ accepted: ['admin@example.com'] });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    const values: Record<string, string> = {
      MAIL_HOST: 'smtp.gmail.com',
      MAIL_USER: 'sender@example.com',
      MAIL_PASS: 'app-password',
      MAIL_FROM: '',
      MODE: 'Prod',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    const service = new MailService(config);

    await service.sendMail({
      to: 'admin@example.com',
      subject: 'Sign-in code',
      html: '<p>code</p>',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Halal Connect <sender@example.com>' }),
    );
  });

  it('renders verification and reset codes in the branded transactional template', async () => {
    const config = {
      get: (key: string) => ({ APP_NAME: 'Halal Connect', MODE: 'Prod' })[key],
    } as unknown as ConfigService;
    const service = new MailService(config);
    const sent: Array<{
      to: string;
      subject: string;
      html: string;
      text?: string;
    }> = [];
    jest.spyOn(service, 'sendMail').mockImplementation((args) => {
      sent.push(args);
      return Promise.resolve({});
    });

    await service.sendCodeEmail('member@example.com', '123456', 'verify');
    await service.sendCodeEmail('member@example.com', '654321', 'reset');

    expect(sent).toHaveLength(2);
    expect(sent[0].subject).toBe('Verify your email for Halal Connect');
    expect(sent[0].html).toContain('123456');
    expect(sent[0].html).toContain('border-bottom:3px solid #bf83fe');
    expect(sent[0].text).toContain('expires in 15 minutes');
    expect(sent[1].subject).toBe('Reset your Halal Connect password');
    expect(sent[1].html).toContain('654321');
  });

  it('builds a professional payment receipt and formats zero-decimal currencies', async () => {
    const values: Record<string, string> = {
      APP_NAME: 'Halal Connect',
      MODE: 'Prod',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    const service = new MailService(config);
    const sent: Array<{
      to: string;
      subject: string;
      html: string;
      text?: string;
    }> = [];
    jest.spyOn(service, 'sendMail').mockImplementation((args) => {
      sent.push(args);
      return Promise.resolve({});
    });

    await service.sendPaymentReceipt({
      to: 'member@example.com',
      customerName: 'Amina',
      itemName: 'Premium subscription',
      amount: service.formatPaymentAmount(999, 'USD'),
      provider: 'stripe',
      reference: 'order-123',
      purchasedAt: new Date('2026-10-07T12:00:00.000Z'),
    });

    expect(service.formatPaymentAmount(10000, 'UGX')).toContain('10,000');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Payment receipt from Halal Connect');
    expect(sent[0].text).toContain('Total paid: $9.99');
    expect(sent[0].html).toContain('Payment confirmed');
    expect(sent[0].html).toContain('Premium subscription');
    expect(sent[0].html).toContain('order-123');
  });
});
