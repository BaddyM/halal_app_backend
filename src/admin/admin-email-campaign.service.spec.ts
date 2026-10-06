import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { AdminEmailCampaignService } from './admin-email-campaign.service';
import { SendEmailCampaignDto } from './dto';

type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type MailAddress = string | { address: string };
type MailResult = { accepted: MailAddress[]; rejected: MailAddress[] };

type FakeMailService = {
  isConfigured: jest.Mock<boolean, []>;
  sendMail: jest.Mock<Promise<MailResult>, [MailMessage]>;
};

describe('AdminEmailCampaignService', () => {
  let mail: FakeMailService;
  let service: AdminEmailCampaignService;

  beforeEach(() => {
    mail = {
      isConfigured: jest.fn<boolean, []>().mockReturnValue(true),
      sendMail: jest
        .fn<Promise<MailResult>, [MailMessage]>()
        .mockResolvedValue({ accepted: [], rejected: [] }),
    };
    service = new AdminEmailCampaignService(mail as unknown as MailService);
  });

  it('sends a personalized, escaped email through the shared mail service', async () => {
    const input: SendEmailCampaignDto = {
      recipients: [{ email: 'member@example.com', name: '<Sam>' }],
      subject: 'Hello {{name}}',
      body: 'Welcome, {{name}}',
      template: 'branded',
    };

    await expect(service.send(input)).resolves.toEqual({ sent: 1, failed: [] });
    const [message] = mail.sendMail.mock.calls[0] ?? [];
    expect(message).toMatchObject({
      to: 'member@example.com',
      subject: 'Hello <Sam>',
      text: 'Welcome, <Sam>',
    });
    expect(message?.html).toContain('Welcome, &lt;Sam&gt;');
  });

  it('deduplicates recipient addresses without regard to case', async () => {
    const input: SendEmailCampaignDto = {
      recipients: [
        { email: 'member@example.com' },
        { email: 'MEMBER@example.com' },
      ],
      subject: 'Notice',
      body: 'Message',
    };

    await expect(service.send(input)).resolves.toEqual({ sent: 1, failed: [] });
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
  });

  it('returns partial failures without stopping the remaining recipients', async () => {
    mail.sendMail
      .mockRejectedValueOnce(
        Object.assign(new Error('SMTP failure'), { code: 'EAUTH' }),
      )
      .mockResolvedValueOnce({ accepted: [], rejected: [] });
    const input: SendEmailCampaignDto = {
      recipients: [
        { email: 'first@example.com' },
        { email: 'second@example.com' },
      ],
      subject: 'Notice',
      body: 'Message',
    };

    await expect(service.send(input)).resolves.toEqual({
      sent: 1,
      failed: [{ email: 'first@example.com', error: 'Email delivery failed' }],
    });
    expect(mail.sendMail).toHaveBeenCalledTimes(2);
  });

  it('counts an explicitly rejected recipient as failed', async () => {
    mail.sendMail.mockResolvedValue({
      accepted: [],
      rejected: [{ address: 'member@example.com' }],
    });

    await expect(
      service.send({
        recipients: [{ email: 'member@example.com' }],
        subject: 'Notice',
        body: 'Message',
      }),
    ).resolves.toEqual({
      sent: 0,
      failed: [{ email: 'member@example.com', error: 'Email delivery failed' }],
    });
  });

  it('refuses to send when SMTP is not configured', async () => {
    mail.isConfigured.mockReturnValue(false);

    await expect(
      service.send({
        recipients: [{ email: 'member@example.com' }],
        subject: 'Notice',
        body: 'Message',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
});
