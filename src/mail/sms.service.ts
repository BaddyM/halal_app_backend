import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('TWILIO_ACCOUNT_SID') &&
        this.config.get<string>('TWILIO_AUTH_TOKEN') &&
        this.config.get<string>('TWILIO_FROM'),
    );
  }

  async sendCode(to: string, code: string): Promise<boolean> {
    const appName = this.config.get<string>('APP_NAME') ?? 'Halal Dating';
    return this.send(to, `${appName} verification code: ${code}`);
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    return this.send(to, message);
  }

  private async send(to: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`SMS not sent. Twilio is not configured. To: ${to}`);
      return false;
    }

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')!;
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')!;
    const body = new URLSearchParams({
      To: to,
      From: this.config.get<string>('TWILIO_FROM')!,
      Body: message,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Twilio rejected SMS (${response.status}): ${detail}`);
    }
    return true;
  }
}