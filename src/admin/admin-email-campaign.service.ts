import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { SendEmailCampaignDto } from './dto';

const LOGO_URL = 'https://halalconnect.space/halal-connect-logo.png';

@Injectable()
export class AdminEmailCampaignService {
  private readonly logger = new Logger(AdminEmailCampaignService.name);

  constructor(private readonly mail: MailService) {}

  async send(input: SendEmailCampaignDto) {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException('Email delivery is not configured');
    }

    const recipients = [
      ...new Map(
        input.recipients.map((recipient) => [
          recipient.email.trim().toLowerCase(),
          { ...recipient, email: recipient.email.trim() },
        ]),
      ).values(),
    ];
    const failed: { email: string; error: string }[] = [];
    let sent = 0;

    for (const recipient of recipients) {
      const subject = personalise(input.subject, recipient.name);
      try {
        const result: unknown = await this.mail.sendMail({
          to: recipient.email,
          subject,
          html: this.renderHtml(input, recipient.name, subject),
          text: personalise(input.body, recipient.name),
        });
        if (recipientWasRejected(result, recipient.email)) {
          throw new Error('SMTP_REJECTED');
        }
        sent += 1;
      } catch (error) {
        this.logger.warn(
          `Campaign email delivery failed (${this.getErrorCode(error)})`,
        );
        failed.push({
          email: recipient.email,
          error: 'Email delivery failed',
        });
      }
    }

    return { sent, failed };
  }

  private renderHtml(
    input: SendEmailCampaignDto,
    name: string | undefined,
    subject: string,
  ) {
    const content = personalise(input.body, name)
      .split(/\n{2,}/)
      .map(
        (paragraph) =>
          `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3f3552;">${escapeHtml(
            paragraph,
          ).replace(/\n/g, '<br/>')}</p>`,
      )
      .join('');

    if (input.template === 'plain') {
      return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;">${content}<p style="font-size:12px;color:#8b83a0;">Halal Connect</p></div>`;
    }

    const heading = personalise(input.heading || input.subject, name);
    const preheader = personalise(input.preheader || input.subject, name);
    const ctaLabel = input.ctaLabel
      ? personalise(input.ctaLabel, name)
      : undefined;
    const cta =
      ctaLabel && input.ctaUrl
        ? `<tr><td style="padding:8px 32px 32px;"><a href="${escapeHtml(
            input.ctaUrl,
          )}" rel="noopener noreferrer" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">${escapeHtml(
            ctaLabel,
          )}</a></td></tr>`
        : '';

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f6f4fb;"><span style="display:none;font-size:1px;color:#f6f4fb;">${escapeHtml(
      preheader,
    )}</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4fb;padding:32px 12px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;"><tr><td style="background:#7c3aed;padding:24px 32px;"><img src="${LOGO_URL}" width="48" height="72" alt="Halal Connect" style="display:block;border:0;width:48px;height:72px;object-fit:contain;"><div style="font-size:20px;font-weight:700;color:#fff;">Halal Connect</div></td></tr><tr><td style="padding:32px 32px 8px;"><h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#2c2340;">${escapeHtml(
      heading,
    )}</h1>${content}</td></tr>${cta}<tr><td style="padding:20px 32px 28px;border-top:1px solid #efeaf9;"><p style="margin:0;font-size:12px;line-height:1.6;color:#8b83a0;">You are receiving this email because you have a Halal Connect account.<br>© ${new Date().getFullYear()} Halal Connect. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
  }

  private getErrorCode(error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code;
    }
    return 'SMTP_ERROR';
  }
}

function greetingName(name?: string | null) {
  const clean = (name ?? '').trim().replace(/\s+/g, ' ');
  if (
    !clean ||
    clean.includes('@') ||
    /^(user|member|unknown|n\/?a)$/i.test(clean)
  ) {
    return 'there';
  }
  return clean.split(' ')[0];
}

function personalise(text: string, name?: string | null) {
  return text.replace(/\{\{\s*name\s*\}\}/gi, greetingName(name));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recipientWasRejected(result: unknown, email: string) {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('rejected' in result) ||
    !Array.isArray(result.rejected)
  ) {
    return false;
  }

  return result.rejected.some((address: unknown) => {
    if (typeof address === 'string') {
      return address.toLowerCase() === email.toLowerCase();
    }
    return (
      typeof address === 'object' &&
      address !== null &&
      'address' in address &&
      typeof address.address === 'string' &&
      address.address.toLowerCase() === email.toLowerCase()
    );
  });
}
