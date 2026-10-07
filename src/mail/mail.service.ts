import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly resendApiKey: string | undefined;
  private readonly resendFrom: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST')?.trim();
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASS');
    this.resendApiKey =
      this.config.get<string>('RESEND_API_KEY')?.trim() || undefined;
    this.resendFrom =
      this.config.get<string>('RESEND_FROM') ??
      'Halal Connect <team@halalconnect.space>';

    this.fromAddress =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      user?.trim() ||
      'no-reply@localhost';
    this.fromName =
      this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'Halal Connect';

    if (host && user && pass) {
      const smtpPassword =
        host.toLowerCase() === 'smtp.gmail.com'
          ? pass.replace(/\s/g, '')
          : pass;
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('MAIL_PORT') ?? '587'),
        secure:
          this.config.get<string>('MAIL_SECURE') === 'true' ||
          this.config.get<string>('MAIL_SECURE') === '1',
        auth: { user: user.trim(), pass: smtpPassword },
      });
    } else {
      this.transporter = null;
      if (this.config.get<string>('MODE') !== 'Dev') {
        this.logger.warn(
          'SMTP is not configured. Email delivery is disabled and messages will only be logged.',
        );
      }
    }
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  isResendConfigured(): boolean {
    return !!this.resendApiKey;
  }

  async sendMail(args: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<unknown> {
    if (!this.transporter) {
      this.logger.warn(
        `Email not sent. SMTP not configured. To: ${args.to} Subject: ${args.subject}`,
      );
      if (this.config.get<string>('MODE') !== 'Dev') {
        throw new ServiceUnavailableException(
          'Email delivery is not configured',
        );
      }
      return { accepted: [args.to], rejected: [], messageId: null };
    }

    try {
      return await this.transporter.sendMail({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : 'SMTP_ERROR';
      this.logger.error(`SMTP email delivery failed (${code})`);
      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable. Please try again later.',
      );
    }
  }

  async sendResendMail(args: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    if (!this.resendApiKey) {
      throw new ServiceUnavailableException(
        'Resend email delivery is not configured',
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.resendFrom,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!response.ok) {
      throw new ResendApiError(response.status);
    }

    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('id' in result) ||
      typeof result.id !== 'string'
    ) {
      throw new Error('Resend did not return an email ID');
    }

    return { id: result.id };
  }

  async sendCodeEmail(to: string, code: string, kind: 'verify' | 'reset') {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const safeCode = this.escapeHtml(code);
    const subject =
      kind === 'verify'
        ? `Verify your email for ${appName}`
        : `Reset your ${appName} password`;
    const heading =
      kind === 'verify' ? 'Verify your email' : 'Reset your password';
    const action =
      kind === 'verify'
        ? 'Enter this code in the app to verify your email and continue setting up your account.'
        : 'Enter this code in the app to choose a new password.';
    const validity =
      kind === 'verify'
        ? 'This code expires in 15 minutes.'
        : 'This code expires in 15 minutes. If you did not request a password reset, secure your account by changing your password.';
    const text = `${heading}\n\n${action}\n\n${code}\n\n${validity}\n\nIf you did not request this, you can safely ignore this email.`;
    const html = this.renderEmail(
      `
        <h1 style="margin:0 0 16px;color:#622cb5;font-size:25px;line-height:1.3;">${heading}</h1>
        <p style="margin:0 0 20px;color:#67677a;font-size:15px;line-height:1.65;">${action}</p>
        <div style="margin:0 0 20px;padding:18px 12px;border:1px solid #e5e3ee;border-radius:12px;background:#f2f0fb;text-align:center;">
          <span style="color:#622cb5;font-size:32px;font-weight:700;letter-spacing:8px;">${safeCode}</span>
        </div>
        <p style="margin:0 0 12px;color:#67677a;font-size:14px;line-height:1.6;">${validity}</p>
        <p style="margin:0;color:#67677a;font-size:13px;line-height:1.6;">If you did not request this, you can safely ignore this email. Never share this code with anyone.</p>
      `,
      `${heading} — use the code in your Halal Connect app.`,
    );

    return this.sendMail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendAdminLoginCode(to: string, code: string) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const email = {
      to,
      subject: `${appName} admin sign-in code`,
      html: this.renderEmail(
        `
          <h1 style="margin:0 0 16px;color:#622cb5;font-size:25px;">Admin sign-in</h1>
          <p style="margin:0 0 20px;color:#67677a;font-size:15px;line-height:1.65;">Enter this one-time code to finish signing in:</p>
          <div style="margin:0 0 20px;padding:18px 12px;border:1px solid #e5e3ee;border-radius:12px;background:#f2f0fb;text-align:center;">
            <span style="color:#622cb5;font-size:32px;font-weight:700;letter-spacing:8px;">${this.escapeHtml(code)}</span>
          </div>
          <p style="margin:0;color:#67677a;font-size:13px;line-height:1.6;">This code expires in 10 minutes. If you did not request it, do not share the code and contact your administrator.</p>
        `,
        'Your one-time Halal Connect admin sign-in code.',
      ),
      text: `${appName} admin sign-in code: ${code}. It expires in 10 minutes.`,
    };
    return this.resendApiKey
      ? this.sendResendMail(email)
      : this.sendMail(email);
  }

  async sendWelcomeEmail(to: string, name: string) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const safeName = this.escapeHtml(name || 'there');
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://halalconnect.space';
    return this.sendMail({
      to,
      subject: `Welcome to ${appName}`,
      html: this.renderEmail(
        `
          <h1 style="margin:0 0 16px;color:#622cb5;font-size:25px;">Assalamu alaikum ${safeName},</h1>
          <p style="margin:0 0 14px;color:#67677a;font-size:15px;line-height:1.65;">Welcome to ${this.escapeHtml(appName)}. Your account is ready.</p>
          <p style="margin:0 0 22px;color:#67677a;font-size:15px;line-height:1.65;">Complete your profile and add a photo to help potential matches get to know you.</p>
          <p style="margin:0 0 24px;"><a href="${this.escapeHtml(frontendUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#8047e1;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">Open ${this.escapeHtml(appName)}</a></p>
          <p style="margin:0;color:#67677a;font-size:14px;line-height:1.6;">May Allah grant you a righteous spouse.</p>
        `,
        `Welcome to ${appName}. Your account is ready.`,
      ),
      text: `Assalamu alaikum ${name || 'there'},\n\nWelcome to ${appName}. Your account is ready.\nComplete your profile and add a photo so you start appearing in matches.`,
    });
  }

  formatPaymentAmount(amount: number, currency: string): string {
    const normalizedCurrency = currency.toUpperCase();
    const zeroDecimalCurrencies = new Set([
      'UGX',
      'KES',
      'TZS',
      'RWF',
      'BIF',
      'XOF',
      'XAF',
    ]);
    const displayAmount = zeroDecimalCurrencies.has(normalizedCurrency)
      ? amount
      : amount / 100;

    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: zeroDecimalCurrencies.has(normalizedCurrency)
          ? 0
          : 2,
        maximumFractionDigits: zeroDecimalCurrencies.has(normalizedCurrency)
          ? 0
          : 2,
      }).format(displayAmount);
    } catch {
      return `${normalizedCurrency} ${displayAmount.toFixed(2)}`;
    }
  }

  async sendPaymentReceipt(args: {
    to: string;
    customerName: string;
    itemName: string;
    amount: string;
    provider: string;
    reference: string;
    purchasedAt: Date;
    subtotal?: string;
    discount?: string;
  }) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const safeName = this.escapeHtml(args.customerName || 'there');
    const safeItem = this.escapeHtml(args.itemName);
    const safeAmount = this.escapeHtml(args.amount);
    const safeProvider = this.escapeHtml(args.provider);
    const safeReference = this.escapeHtml(args.reference);
    const paidAt = args.purchasedAt.toLocaleString('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
    const safePaidAt = this.escapeHtml(`${paidAt} UTC`);
    const discountRow = args.discount
      ? `<tr><td style="padding:10px 0;color:#67677a;border-bottom:1px solid #e5e3ee;">Discount</td><td align="right" style="padding:10px 0;color:#622cb5;font-weight:600;border-bottom:1px solid #e5e3ee;">${this.escapeHtml(args.discount)}</td></tr>`
      : '';
    const subtotalRow = args.subtotal
      ? `<tr><td style="padding:10px 0;color:#67677a;border-bottom:1px solid #e5e3ee;">Subtotal</td><td align="right" style="padding:10px 0;color:#67677a;border-bottom:1px solid #e5e3ee;">${this.escapeHtml(args.subtotal)}</td></tr>`
      : '';
    const subject = `Payment receipt from ${appName}`;
    const text = [
      `Assalamu alaikum ${args.customerName || 'there'},`,
      '',
      `Your payment was successful. Here is your receipt:`,
      `Item: ${args.itemName}`,
      ...(args.subtotal ? [`Subtotal: ${args.subtotal}`] : []),
      ...(args.discount ? [`Discount: ${args.discount}`] : []),
      `Total paid: ${args.amount}`,
      `Payment method: ${args.provider}`,
      `Date: ${paidAt} UTC`,
      `Reference: ${args.reference}`,
      '',
      `Thank you for supporting ${appName}.`,
    ].join('\n');
    return this.sendMail({
      to: args.to,
      subject,
      text,
      html: this.renderEmail(
        `
          <h1 style="margin:0 0 12px;color:#622cb5;font-size:25px;">Payment confirmed</h1>
          <p style="margin:0 0 22px;color:#67677a;font-size:15px;line-height:1.65;">Assalamu alaikum ${safeName}, your payment was successful. Keep this email as your receipt.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e5e3ee;">
            <tr><td style="padding:12px 0;color:#67677a;border-bottom:1px solid #e5e3ee;">Item</td><td align="right" style="padding:12px 0;color:#622cb5;font-weight:600;border-bottom:1px solid #e5e3ee;">${safeItem}</td></tr>
            ${subtotalRow}
            ${discountRow}
            <tr><td style="padding:12px 0;color:#622cb5;font-weight:700;border-bottom:1px solid #e5e3ee;">Total paid</td><td align="right" style="padding:12px 0;color:#622cb5;font-size:17px;font-weight:700;border-bottom:1px solid #e5e3ee;">${safeAmount}</td></tr>
            <tr><td style="padding:10px 0;color:#67677a;">Payment method</td><td align="right" style="padding:10px 0;color:#1c172b;">${safeProvider}</td></tr>
            <tr><td style="padding:10px 0;color:#67677a;">Date</td><td align="right" style="padding:10px 0;color:#1c172b;">${safePaidAt}</td></tr>
            <tr><td style="padding:10px 0;color:#67677a;">Reference</td><td align="right" style="padding:10px 0;color:#1c172b;word-break:break-all;">${safeReference}</td></tr>
          </table>
          <p style="margin:20px 0 0;color:#67677a;font-size:13px;line-height:1.6;">If you do not recognize this payment, please contact support and include the reference above.</p>
        `,
        'Your payment was successful. Your receipt is inside.',
      ),
    });
  }

  async sendWaliInvitation(args: {
    to: string;
    waliName: string;
    userName: string;
    message?: string;
    invitationToken: string;
    declineToken?: string;
  }) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const acceptUrl = `${frontendUrl}/api/wali/confirm/${encodeURIComponent(args.invitationToken)}`;
    const declineUrl = args.declineToken
      ? `${frontendUrl}/api/wali/decline/${encodeURIComponent(args.declineToken)}`
      : undefined;
    const safeWaliName = this.escapeHtml(args.waliName);
    const safeUserName = this.escapeHtml(args.userName);
    const safeMessage = args.message ? this.escapeHtml(args.message) : '';
    const subject = `${args.userName} has invited you as their Wali (Guardian)`;
    const text = [
      `Hello ${args.waliName},`,
      '',
      `${args.userName} has invited you to be their Wali (Guardian) on ${appName}.`,
      'As Wali, you may receive conversation summaries when the user chooses to involve you.',
      'Updates follow the member’s consent and the delivery schedule selected by the service.',
      ...(args.message
        ? ['', `Message from ${args.userName}: ${args.message}`]
        : []),
      '',
      `Accept invitation: ${acceptUrl}`,
      ...(declineUrl ? [`Decline invitation: ${declineUrl}`] : []),
    ].join('\n');
    const html = this.renderEmail(
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1c172b;">
        <h2>${this.escapeHtml(appName)}: Wali invitation</h2>
        <p>Hello ${safeWaliName},</p>
        <p><strong>${safeUserName}</strong> has invited you to be their Wali (Guardian).</p>
        <p>When the user chooses to involve you, you may receive conversation updates by email, subject to their consent and the service delivery schedule.</p>
        ${safeMessage ? `<p><strong>Message from ${safeUserName}:</strong> ${safeMessage}</p>` : ''}
        <p><a href="${acceptUrl}">Accept Wali invitation</a></p>
        ${declineUrl ? `<p><a href="${declineUrl}">Decline invitation</a></p>` : ''}
        <p style="font-size: 12px; color: #667">This invitation does not provide access to the user's account or password.</p>
      </div>
    `,
      'You have received a Wali invitation.',
    );
    return this.sendMail({ to: args.to, subject, html, text });
  }

  async sendWaliCcTest(to: string) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const subject = `${appName}: test guardian CC email`;
    const text =
      'This is a test guardian CC email. Your email delivery settings are working.';
    return this.sendMail({
      to,
      subject,
      text,
      html: this.renderEmail(
        `
          <h1 style="margin:0 0 16px;color:#622cb5;font-size:25px;">${this.escapeHtml(appName)} guardian CC test</h1>
          <p style="margin:0;color:#67677a;font-size:15px;line-height:1.65;">This is a test email only. Guardian CC email delivery is working.</p>
        `,
        'A test message confirming guardian email delivery.',
      ),
    });
  }

  async sendWaliSummary(args: {
    to: string;
    userName: string;
    participantNames: string;
    summary: string;
    messageCount: number;
    frequency: 'instant' | 'daily' | 'weekly';
  }) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const frequencyLabel = {
      instant: 'instant conversation update',
      daily: 'daily conversation digest',
      weekly: 'weekly conversation digest',
    }[args.frequency];
    const subject = `${frequencyLabel} for ${args.participantNames}`;
    const safeUserName = this.escapeHtml(args.userName);
    const safeParticipants = this.escapeHtml(args.participantNames);
    const safeSummary = this.escapeHtml(args.summary);
    const intro =
      args.frequency === 'instant'
        ? 'Here is the new message the member has chosen to share.'
        : `Here is the ${args.frequency} conversation update.`;
    const text = `Hello,\n\n${intro} Summary for ${args.userName}.\n\n${args.summary}`;
    const html = this.renderEmail(
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1c172b;">
        <h2>${this.escapeHtml(appName)}: ${this.escapeHtml(frequencyLabel)}</h2>
        <p>Hello,</p>
        <p>${this.escapeHtml(intro)} Summary for <strong>${safeUserName}</strong>.</p>
        <p><strong>Conversation:</strong> ${safeParticipants}</p>
        <p><strong>Recent messages:</strong> ${args.messageCount}</p>
        <pre style="white-space: pre-wrap; background: #f4f6f7; padding: 16px; border-radius: 8px;">${safeSummary}</pre>
      </div>
    `,
      `${frequencyLabel} from ${appName}.`,
    );
    return this.sendMail({ to: args.to, subject, html, text });
  }

  async sendWaliChangeNotification(args: {
    to: string;
    waliName: string;
    userName: string;
    changedFields: string[];
  }) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const subject = `${args.userName} updated your Wali details on ${appName}`;
    const safeWaliName = this.escapeHtml(args.waliName);
    const safeUserName = this.escapeHtml(args.userName);
    const safeFields = this.escapeHtml(args.changedFields.join(', '));
    const text = `Hello ${args.waliName},\n\n${args.userName} updated these Wali details: ${args.changedFields.join(', ')}.\n\nYou will receive conversation summaries only when the user has consented to sharing and according to the service delivery schedule.`;
    const html = this.renderEmail(
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1c172b;">
        <h2>${this.escapeHtml(appName)}: Wali details updated</h2>
        <p>Hello ${safeWaliName},</p>
        <p><strong>${safeUserName}</strong> updated these details connected to your Wali role:</p>
        <p>${safeFields}</p>
        <p>You will receive conversation summaries only when the user has consented to sharing and according to the service delivery schedule.</p>
      </div>
    `,
      `${args.userName} updated the Wali details connected to your account.`,
    );
    return this.sendMail({ to: args.to, subject, html, text });
  }

  private renderEmail(content: string, preview: string): string {
    const appName = this.escapeHtml(
      this.config.get<string>('APP_NAME') ?? 'Halal Connect',
    );
    return `<!doctype html>
      <html lang="en">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#fcfbff;font-family:Arial,Helvetica,sans-serif;color:#1c172b;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${this.escapeHtml(preview)}</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fcfbff;padding:28px 12px;">
            <tr><td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e5e3ee;border-radius:14px;overflow:hidden;">
                <tr><td style="padding:22px 28px;background:#8047e1;border-bottom:3px solid #bf83fe;">
                  <span style="color:#fff;font-size:19px;font-weight:700;letter-spacing:.2px;">${appName}</span>
                  <span style="display:block;margin-top:4px;color:#f2f0fb;font-size:12px;">A respectful space to connect with purpose</span>
                </td></tr>
                <tr><td style="padding:30px 28px;">${content}</td></tr>
                <tr><td style="padding:18px 28px;background:#f2f0fb;border-top:1px solid #e5e3ee;color:#67677a;font-size:12px;line-height:1.6;">
                  This is an automated message from ${appName}. Please do not reply to this email.
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>`;
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] ?? character,
    );
  }
}

class ResendApiError extends Error {
  readonly code: string;

  constructor(status: number) {
    super(`Resend email request failed with status ${status}`);
    this.name = 'ResendApiError';
    this.code = `RESEND_HTTP_${status}`;
  }
}
