import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from 'src/prisma/prisma.service';

/// Sends push notifications via Firebase Admin (FCM, which also fans out to
/// APNs for iOS). Initialises lazily from a service-account credential in env;
/// if none is configured it degrades to a logged no-op so the rest of the app
/// works without Firebase set up.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private initialised = false;
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private ensureInit() {
    if (this.initialised) return;
    this.initialised = true;
    try {
      // FIREBASE_SERVICE_ACCOUNT holds the JSON service-account key (stringified).
      const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
      if (!raw) {
        this.logger.warn('Push disabled: FIREBASE_SERVICE_ACCOUNT not set');
        return;
      }
      const credential = admin.credential.cert(JSON.parse(raw));
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential });
      }
      this.enabled = true;
      this.logger.log('🔔 Firebase push initialised');
    } catch (e) {
      this.logger.error(`Push init failed: ${String(e)}`);
    }
  }

  /// Sends a notification to every registered device of [userId]. Tokens that
  /// the provider reports as invalid are pruned. Safe to call unconditionally.
  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    this.ensureInit();
    if (!this.enabled) {
      this.logger.debug(`[push:noop] → ${userId}: ${payload.title}`);
      return;
    }

    const devices = await this.prisma.device.findMany({ where: { userId } });
    if (devices.length === 0) return;

    const tokens = devices.map((d) => d.token);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });

      // Prune tokens the provider rejected (uninstalled / expired).
      const stale: string[] = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code ?? '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-argument')
          ) {
            stale.push(tokens[i]);
          }
        }
      });
      if (stale.length) {
        await this.prisma.device.deleteMany({ where: { token: { in: stale } } });
      }
    } catch (e) {
      this.logger.error(`Push send failed for ${userId}: ${String(e)}`);
    }
  }
}
