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
  }) {
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
    } catch (error) {
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
    const subject =
      kind === 'verify'
        ? 'Verify your email for Halal Connect'
        : 'Reset your Halal Connect password';

    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ??
      'https://app.halal-dating.local';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2>${appName}</h2>
        <p>Your ${kind === 'verify' ? 'verification' : 'password reset'} code is:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; margin: 20px 0;">${code}</div>
        <p>Use this code in the app to continue.</p>
        <p>If you didn’t request this, you can safely ignore this email.</p>
        <p><a href="${frontendUrl}" target="_blank">Open ${appName}</a></p>
      </div>
    `;

    return this.sendMail({
      to,
      subject,
      html,
      text: `${appName} code: ${code}`,
    });
  }

  async sendAdminLoginCode(to: string, code: string) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    return this.sendMail({
      to,
      subject: `${appName} admin sign-in code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2>${this.escapeHtml(appName)} admin sign-in</h2>
          <p>Enter this one-time code to finish signing in:</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; margin: 20px 0;">${code}</div>
          <p>This code expires in 10 minutes. If you did not request it, change your password.</p>
        </div>
      `,
      text: `${appName} admin sign-in code: ${code}. It expires in 10 minutes.`,
    });
  }

  async sendWelcomeEmail(to: string, name: string) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const safeName = this.escapeHtml(name || 'there');
    return this.sendMail({
      to,
      subject: `Welcome to ${this.escapeHtml(appName)}`,
      html: `
        <p>Assalamu alaikum ${safeName},</p>
        <p>Welcome to ${this.escapeHtml(appName)}. Your account is ready.</p>
        <p>Complete your profile and add a photo so you start appearing in
        matches — profiles with a photo and a full "about" section get seen far
        more often.</p>
        <p>May Allah grant you a righteous spouse.</p>
      `,
      text: `Assalamu alaikum ${name || 'there'},\n\nWelcome to ${appName}. Your account is ready.\nComplete your profile and add a photo so you start appearing in matches.`,
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
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #253238;">
        <h2>${appName}: Wali invitation</h2>
        <p>Hello ${safeWaliName},</p>
        <p><strong>${safeUserName}</strong> has invited you to be their Wali (Guardian).</p>
        <p>When the user chooses to involve you, you may receive conversation updates by email, subject to their consent and the service delivery schedule.</p>
        ${safeMessage ? `<p><strong>Message from ${safeUserName}:</strong> ${safeMessage}</p>` : ''}
        <p><a href="${acceptUrl}">Accept Wali invitation</a></p>
        ${declineUrl ? `<p><a href="${declineUrl}">Decline invitation</a></p>` : ''}
        <p style="font-size: 12px; color: #667">This invitation does not provide access to the user's account or password.</p>
      </div>
    `;
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2>${this.escapeHtml(appName)} guardian CC test</h2>
          <p>This is a test email only. Guardian CC email delivery is working.</p>
        </div>
      `,
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
    const intro = args.frequency === 'instant'
      ? 'Here is the new message the member has chosen to share.'
      : `Here is the ${args.frequency} conversation update.`;
    const text = `Hello,\n\n${intro} Summary for ${args.userName}.\n\n${args.summary}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #253238;">
        <h2>${this.escapeHtml(appName)}: ${this.escapeHtml(frequencyLabel)}</h2>
        <p>Hello,</p>
        <p>${this.escapeHtml(intro)} Summary for <strong>${safeUserName}</strong>.</p>
        <p><strong>Conversation:</strong> ${safeParticipants}</p>
        <p><strong>Recent messages:</strong> ${args.messageCount}</p>
        <pre style="white-space: pre-wrap; background: #f4f6f7; padding: 16px; border-radius: 8px;">${safeSummary}</pre>
      </div>
    `;
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
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #253238;">
        <h2>${appName}: Wali details updated</h2>
        <p>Hello ${safeWaliName},</p>
        <p><strong>${safeUserName}</strong> updated these details connected to your Wali role:</p>
        <p>${safeFields}</p>
        <p>You will receive conversation summaries only when the user has consented to sharing and according to the service delivery schedule.</p>
      </div>
    `;
    return this.sendMail({ to: args.to, subject, html, text });
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
