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

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST');
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASS');

    this.fromAddress =
      this.config.get<string>('MAIL_FROM') ?? user ?? 'no-reply@localhost';
    this.fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'Halal Connect';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('MAIL_PORT') ?? '587'),
        secure:
          this.config.get<string>('MAIL_SECURE') === 'true' ||
          this.config.get<string>('MAIL_SECURE') === '1',
        auth: { user, pass },
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

    const info = await this.transporter.sendMail({
      from: `${this.fromName} <${this.fromAddress}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });

    return info;
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
  }) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const acceptUrl = `${frontendUrl}/api/wali/accept?token=${encodeURIComponent(args.invitationToken)}`;
    const safeWaliName = this.escapeHtml(args.waliName);
    const safeUserName = this.escapeHtml(args.userName);
    const safeMessage = args.message ? this.escapeHtml(args.message) : '';
    const subject = `${args.userName} has invited you as their Wali (Guardian)`;
    const text = [
      `Hello ${args.waliName},`,
      '',
      `${args.userName} has invited you to be their Wali (Guardian) on ${appName}.`,
      'As Wali, you may receive conversation summaries when the user chooses to involve you.',
      'Weekly summaries are sent only when there is recent chat activity and pause after two inactive weeks.',
      ...(args.message
        ? ['', `Message from ${args.userName}: ${args.message}`]
        : []),
      '',
      `Accept invitation: ${acceptUrl}`,
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #253238;">
        <h2>${appName}: Wali invitation</h2>
        <p>Hello ${safeWaliName},</p>
        <p><strong>${safeUserName}</strong> has invited you to be their Wali (Guardian).</p>
        <p>When the user chooses to involve you, you may receive the latest conversation summary by email. Weekly summaries are sent only when there is recent chat activity and pause automatically after two consecutive inactive weeks.</p>
        ${safeMessage ? `<p><strong>Message from ${safeUserName}:</strong> ${safeMessage}</p>` : ''}
        <p><a href="${acceptUrl}">Accept Wali invitation</a></p>
        <p style="font-size: 12px; color: #667">This invitation does not provide access to the user's account or password.</p>
      </div>
    `;
    return this.sendMail({ to: args.to, subject, html, text });
  }

  async sendWaliSummary(args: {
    to: string;
    userName: string;
    participantNames: string;
    summary: string;
    messageCount: number;
  }) {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Connect';
    const subject = `Conversation update for ${args.participantNames}`;
    const safeUserName = this.escapeHtml(args.userName);
    const safeParticipants = this.escapeHtml(args.participantNames);
    const safeSummary = this.escapeHtml(args.summary);
    const text = `Hello,\n\nHere is the latest conversation summary for ${args.userName}.\n\n${args.summary}\n\nThis weekly summary is sent only when there is recent chat activity and pauses after two consecutive inactive weeks.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #253238;">
        <h2>${appName}: conversation summary</h2>
        <p>Hello,</p>
        <p>Here is the latest summary for <strong>${safeUserName}</strong>.</p>
        <p><strong>Conversation:</strong> ${safeParticipants}</p>
        <p><strong>Recent messages:</strong> ${args.messageCount}</p>
        <pre style="white-space: pre-wrap; background: #f4f6f7; padding: 16px; border-radius: 8px;">${safeSummary}</pre>
        <p style="font-size: 12px; color: #667">Weekly summaries are sent only when there is recent chat activity and pause after two consecutive inactive weeks.</p>
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
    const text = `Hello ${args.waliName},\n\n${args.userName} updated these Wali details: ${args.changedFields.join(', ')}.\n\nYou will receive conversation summaries only when the user involves you. Weekly summaries pause after two inactive weeks.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #253238;">
        <h2>${appName}: Wali details updated</h2>
        <p>Hello ${safeWaliName},</p>
        <p><strong>${safeUserName}</strong> updated these details connected to your Wali role:</p>
        <p>${safeFields}</p>
        <p>You will receive conversation summaries only when the user involves you. Weekly summaries pause automatically after two consecutive inactive weeks without chat activity.</p>
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
