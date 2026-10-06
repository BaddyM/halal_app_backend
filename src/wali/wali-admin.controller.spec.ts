import { MailService } from 'src/mail/mail.service';
import { WaliService } from './wali.service';
import { AdminWaliController } from './wali-admin.controller';

describe('AdminWaliController email test', () => {
  it('sends a Wali CC test email to the requested address', async () => {
    const waliService = {} as WaliService;
    const mail = {
      sendWaliCcTest: jest.fn().mockResolvedValue({ messageId: 'test-message' }),
    } as unknown as MailService;
    const controller = new AdminWaliController(waliService, mail);

    await expect(
      controller.sendTestCc({ email: 'wali@example.com' }),
    ).resolves.toEqual({ sent: true });
    expect(mail.sendWaliCcTest).toHaveBeenCalledWith('wali@example.com');
  });
});
