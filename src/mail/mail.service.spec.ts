import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('uses the authenticated SMTP account when MAIL_FROM is empty', async () => {
    const sendMail = jest.fn().mockResolvedValue({ accepted: ['admin@example.com'] });
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
});
