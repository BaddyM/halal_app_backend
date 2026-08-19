import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

/// Android notification channel id. Must match the channel the Flutter app
/// creates (see PushNotificationService) or Android 8+ drops the notification.
export const ANDROID_CHANNEL_ID = 'halal_connect_default';

export interface PushPayload {
  title: string;
  body: string;
  /// FCM requires every data value to be a string; non-strings are coerced.
  data?: Record<string, string | number | boolean | null | undefined>;
}

/// Sends push notifications via Firebase Admin (FCM, which also fans out to
/// APNs for iOS). Initialises lazily from a service-account credential; if none
/// is configured it degrades to a logged no-op so the rest of the app works
/// without Firebase set up.
///
/// Credential resolution order:
///   1. FIREBASE_SERVICE_ACCOUNT      — the service-account JSON, stringified
///   2. FIREBASE_SERVICE_ACCOUNT_PATH — path to the service-account JSON file
///   3. config/*.json                 — first service-account file found there
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private initialised = false;
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /// Locates a service account from env or the config/ directory.
  private loadCredential(): admin.ServiceAccount | null {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (raw) {
      this.logger.log('Using FIREBASE_SERVICE_ACCOUNT from env');
      return JSON.parse(raw);
    }

    const explicitPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (explicitPath) {
      const resolved = path.isAbsolute(explicitPath)
        ? explicitPath
        : path.join(process.cwd(), explicitPath);
      this.logger.log(`Using service account at ${resolved}`);
      return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    }

    // Fall back to scanning config/ so a dropped-in key works with no env setup.
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) return null;
    for (const file of fs.readdirSync(configDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const parsed = JSON.parse(
          fs.readFileSync(path.join(configDir, file), 'utf8'),
        );
        if (parsed?.type === 'service_account' && parsed?.private_key) {
          this.logger.log(`Using service account at config/${file}`);
          return parsed;
        }
      } catch {
        // Not JSON, or not readable — keep looking.
      }
    }
    return null;
  }

  private ensureInit() {
    if (this.initialised) return;
    this.initialised = true;
    try {
      const credential = this.loadCredential();
      if (!credential) {
        this.logger.warn(
          'Push disabled: no Firebase service account (set FIREBASE_SERVICE_ACCOUNT, ' +
            'FIREBASE_SERVICE_ACCOUNT_PATH, or drop the key in config/)',
        );
        return;
      }
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(credential) });
      }
      this.enabled = true;
      this.logger.log(
        `🔔 Firebase push initialised (project ${(credential as any).project_id ?? 'unknown'})`,
      );
    } catch (e) {
      this.logger.error(`Push init failed: ${String(e)}`);
    }
  }

  /// FCM rejects the whole message if any data value is not a string.
  private stringifyData(
    data: PushPayload['data'],
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data ?? {})) {
      if (v === null || v === undefined) continue;
      out[k] = String(v);
    }
    return out;
  }

  /// Sends a notification to every registered device of [userId]. Tokens that
  /// the provider reports as invalid are pruned. Safe to call unconditionally.
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    this.ensureInit();
    if (!this.enabled) {
      this.logger.debug(`[push:noop] → ${userId}: ${payload.title}`);
      return;
    }

    const devices = await this.prisma.device.findMany({ where: { userId } });
    if (devices.length === 0) return;

    await this.sendToTokens(
      devices.map((d) => d.token),
      payload,
    );
  }

  /// Fan-out to several users at once (broadcasts, admin messaging).
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    this.ensureInit();
    if (!this.enabled || userIds.length === 0) return;

    const devices = await this.prisma.device.findMany({
      where: { userId: { in: userIds } },
    });
    if (devices.length === 0) return;

    await this.sendToTokens(
      devices.map((d) => d.token),
      payload,
    );
  }

  /// Low-level multicast. FCM caps sendEachForMulticast at 500 tokens per call,
  /// so oversized audiences are chunked.
  private async sendToTokens(
    tokens: string[],
    payload: PushPayload,
  ): Promise<void> {
    const data = this.stringifyData(payload.data);
    const unique = [...new Set(tokens)];

    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title: payload.title, body: payload.body },
          data,
          android: {
            priority: 'high',
            notification: {
              channelId: ANDROID_CHANNEL_ID,
              sound: 'default',
              // Lets the Flutter app route the tap via onMessageOpenedApp.
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                // Required for the iOS background isolate to receive data.
                contentAvailable: true,
              },
            },
          },
        });

        // Prune tokens the provider rejected (uninstalled / expired).
        const stale: string[] = [];
        res.responses.forEach((r, idx) => {
          if (r.success) return;
          const code = r.error?.code ?? '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            code.includes('invalid-argument')
          ) {
            stale.push(chunk[idx]);
          } else {
            this.logger.warn(`Push failed (${code}): ${r.error?.message}`);
          }
        });
        if (stale.length) {
          await this.prisma.device.deleteMany({
            where: { token: { in: stale } },
          });
          this.logger.log(`Pruned ${stale.length} stale device token(s)`);
        }
      } catch (e) {
        this.logger.error(`Push send failed: ${String(e)}`);
      }
    }
  }
}
