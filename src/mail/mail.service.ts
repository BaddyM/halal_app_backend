import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

    this.fromAddress = this.config.get<string>('MAIL_FROM') ?? user ?? 'no-reply@localhost';
    this.fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'Halal Dating';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('MAIL_PORT') ?? '587'),
        secure: this.config.get<string>('MAIL_SECURE') === 'true' || this.config.get<string>('MAIL_SECURE') === '1',
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

  async sendMail(args: { to: string; subject: string; html: string; text?: string }) {
    if (!this.transporter) {
      this.logger.warn(`Email not sent. SMTP not configured. To: ${args.to} Subject: ${args.subject}`);
      if (this.config.get<string>('MODE') !== 'Dev') {
        throw new ServiceUnavailableException('Email delivery is not configured');
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
        ? 'Verify your email for Halal Dating'
        : 'Reset your Halal Dating password';

    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Dating';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://app.halal-dating.local';
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
}
