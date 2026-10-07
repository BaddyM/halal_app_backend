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
  isResendConfigured: jest.Mock<boolean, []>;
  sendResendMail: jest.Mock<Promise<MailResult>, [MailMessage]>;
};

describe('AdminEmailCampaignService', () => {
  let mail: FakeMailService;
  let service: AdminEmailCampaignService;

  beforeEach(() => {
    mail = {
      isResendConfigured: jest.fn<boolean, []>().mockReturnValue(true),
      sendResendMail: jest
        .fn<Promise<MailResult>, [MailMessage]>()
        .mockResolvedValue({ accepted: [], rejected: [] }),
    };
    service = new AdminEmailCampaignService(mail as unknown as MailService);
  });

  it('sends a personalized, escaped email through Resend', async () => {
    const input: SendEmailCampaignDto = {
      recipients: [{ email: 'member@example.com', name: '<Sam>' }],
      subject: 'Hello {{name}}',
      body: 'Welcome, {{name}}',
      template: 'branded',
    };

    await expect(service.send(input)).resolves.toEqual({ sent: 1, failed: [] });
    const [message] = mail.sendResendMail.mock.calls[0] ?? [];
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
    expect(mail.sendResendMail).toHaveBeenCalledTimes(1);
  });

  it('returns partial failures without stopping the remaining recipients', async () => {
    mail.sendResendMail
      .mockRejectedValueOnce(
        Object.assign(new Error('Resend API key rejected'), {
          code: 'RESEND_HTTP_401',
        }),
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
      failed: [
        {
          email: 'first@example.com',
          error:
            'Resend rejected the API key (401). Check RESEND_API_KEY on the backend.',
        },
      ],
    });
    expect(mail.sendResendMail).toHaveBeenCalledTimes(2);
  });

  it('counts an explicitly rejected recipient as failed', async () => {
    mail.sendResendMail.mockResolvedValue({
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
      failed: [
        {
          email: 'member@example.com',
          error:
            'Resend rejected this recipient. Check the address and Resend delivery logs.',
        },
      ],
    });
  });

  it('refuses to send when Resend is not configured', async () => {
    mail.isResendConfigured.mockReturnValue(false);

    await expect(
      service.send({
        recipients: [{ email: 'member@example.com' }],
        subject: 'Notice',
        body: 'Message',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mail.sendResendMail).not.toHaveBeenCalled();
  });
});
