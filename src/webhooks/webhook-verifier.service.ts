import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  X509Certificate,
  createHmac,
  createPublicKey,
  createVerify,
  timingSafeEqual,
} from 'crypto';

/// Stripe rejects signatures older than this to blunt replay attacks; we match
/// their default tolerance.
const STRIPE_TOLERANCE_SECONDS = 300;
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_TTL_MS = 60 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/// Converts a JOSE ES256 signature (r‖s, 64 bytes) to the DER encoding that
/// Node's verifier expects.
function joseToDer(sig: Buffer): Buffer {
  const r = sig.subarray(0, 32);
  const s = sig.subarray(32, 64);
  const trim = (b: Buffer) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    const out = b.subarray(i);
    return out[0] & 0x80 ? Buffer.concat([Buffer.from([0]), out]) : out;
  };
  const rt = trim(r);
  const st = trim(s);
  return Buffer.concat([
    Buffer.from([0x30, rt.length + st.length + 4]),
    Buffer.from([0x02, rt.length]),
    rt,
    Buffer.from([0x02, st.length]),
    st,
  ]);
}

/// Verifies that a webhook really came from the payment provider it claims.
///
/// Every method **fails closed**: if the provider's verifying material is not
/// configured, the request is rejected rather than trusted. Without this the
/// billing webhooks are an open endpoint that grants paid plans to anyone who
/// can POST a `userId`.
@Injectable()
export class WebhookVerifierService {
  private readonly logger = new Logger(WebhookVerifierService.name);
  private jwksCache: { fetchedAt: number; keys: any[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  /// Escape hatch for local development only. Requires BOTH an explicit opt-in
  /// flag and Dev mode, so it cannot be switched on by a stray env var in
  /// production.
  private devBypass(provider: string): boolean {
    const allowed =
      this.config.get<string>('ALLOW_UNVERIFIED_WEBHOOKS') === 'true' &&
      this.config.get<string>('MODE') === 'Dev';
    if (allowed) {
      this.logger.warn(
        `[${provider}] signature verification BYPASSED (ALLOW_UNVERIFIED_WEBHOOKS=true, MODE=Dev). Never enable this in production.`,
      );
    }
    return allowed;
  }

  private reject(provider: string, reason: string): never {
    this.logger.warn(`[${provider}] webhook rejected: ${reason}`);
    throw new UnauthorizedException('Invalid webhook signature');
  }

  // ── Stripe ────────────────────────────────────────────────────────
  /// HMAC-SHA256 over `${timestamp}.${rawBody}` keyed by the endpoint secret,
  /// compared against every `v1=` entry in the `stripe-signature` header.
  verifyStripe(rawBody: Buffer | undefined, signatureHeader?: string): void {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      if (this.devBypass('stripe')) return;
      this.reject('stripe', 'STRIPE_WEBHOOK_SECRET is not configured');
    }
    if (!rawBody?.length) this.reject('stripe', 'raw body unavailable');
    if (!signatureHeader) this.reject('stripe', 'missing stripe-signature header');

    let timestamp = '';
    const provided: string[] = [];
    for (const part of signatureHeader.split(',')) {
      const [key, value] = part.split('=', 2);
      if (key?.trim() === 't') timestamp = value?.trim() ?? '';
      if (key?.trim() === 'v1' && value) provided.push(value.trim());
    }
    if (!timestamp || provided.length === 0) {
      this.reject('stripe', 'malformed stripe-signature header');
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > STRIPE_TOLERANCE_SECONDS) {
      this.reject('stripe', `timestamp outside tolerance (${Math.round(age)}s)`);
    }

    const expected = createHmac('sha256', secret!)
      .update(`${timestamp}.${rawBody!.toString('utf8')}`)
      .digest('hex');
    if (!provided.some((candidate) => safeEqual(candidate, expected))) {
      this.reject('stripe', 'signature mismatch');
    }
  }

  // ── Apple ─────────────────────────────────────────────────────────
  /// App Store Server Notifications v2 arrive as a JWS in `signedPayload`,
  /// signed by a certificate chain that must root in Apple's CA. Returns the
  /// decoded payload so the caller never has to parse it unverified.
  verifyApple(body: any): any {
    const signedPayload: string | undefined = body?.signedPayload;
    const rootPem = this.config.get<string>('APPLE_ROOT_CA_PEM');

    if (!signedPayload) {
      // Older/relayed notifications are plain JSON. Only honour those when a
      // shared relay secret proves the sender, otherwise fail closed.
      if (this.devBypass('apple')) return body;
      this.reject('apple', 'missing signedPayload');
    }
    if (!rootPem) {
      if (this.devBypass('apple')) return this.decodeAppleUnverified(signedPayload!);
      this.reject('apple', 'APPLE_ROOT_CA_PEM is not configured');
    }

    const [headerB64, payloadB64, signatureB64] = signedPayload!.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      this.reject('apple', 'malformed JWS');
    }

    let header: any;
    try {
      header = JSON.parse(b64urlToBuffer(headerB64).toString('utf8'));
    } catch {
      this.reject('apple', 'unparseable JWS header');
    }
    if (header.alg !== 'ES256') this.reject('apple', `unexpected alg ${header.alg}`);

    const x5c: string[] = header.x5c ?? [];
    if (x5c.length < 2) this.reject('apple', 'missing x5c certificate chain');

    const chain = x5c.map(
      (der) => new X509Certificate(Buffer.from(der, 'base64')),
    );

    const now = new Date();
    for (const cert of chain) {
      if (new Date(cert.validFrom) > now || new Date(cert.validTo) < now) {
        this.reject('apple', 'certificate in chain is outside its validity window');
      }
    }
    // Each certificate must be signed by the next one up.
    for (let i = 0; i < chain.length - 1; i++) {
      if (!chain[i].verify(chain[i + 1].publicKey)) {
        this.reject('apple', `chain link ${i} → ${i + 1} failed verification`);
      }
    }
    // ...and the top of the chain must be the pinned Apple root.
    const pinned = new X509Certificate(rootPem!);
    const top = chain[chain.length - 1];
    if (top.fingerprint256 !== pinned.fingerprint256) {
      this.reject('apple', 'chain does not terminate at the pinned Apple root CA');
    }

    const verifier = createVerify('SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const der = joseToDer(b64urlToBuffer(signatureB64));
    if (!verifier.verify(chain[0].publicKey, der)) {
      this.reject('apple', 'payload signature mismatch');
    }

    return JSON.parse(b64urlToBuffer(payloadB64).toString('utf8'));
  }

  private decodeAppleUnverified(signedPayload: string): any {
    try {
      return JSON.parse(b64urlToBuffer(signedPayload.split('.')[1]).toString('utf8'));
    } catch {
      return {};
    }
  }

  // ── Google Play ───────────────────────────────────────────────────
  /// Pub/Sub push supports two proofs of origin. Either satisfies us:
  ///  - a `?token=` query parameter matching GOOGLE_PUBSUB_VERIFICATION_TOKEN
  ///  - an OIDC bearer JWT signed by Google for GOOGLE_PUBSUB_OIDC_AUDIENCE
  async verifyGoogle(query: any, authorization?: string): Promise<void> {
    const token = this.config.get<string>('GOOGLE_PUBSUB_VERIFICATION_TOKEN');
    const audience = this.config.get<string>('GOOGLE_PUBSUB_OIDC_AUDIENCE');

    if (!token && !audience) {
      if (this.devBypass('google')) return;
      this.reject(
        'google',
        'neither GOOGLE_PUBSUB_VERIFICATION_TOKEN nor GOOGLE_PUBSUB_OIDC_AUDIENCE is configured',
      );
    }

    if (token) {
      const provided = String(query?.token ?? '');
      if (provided && safeEqual(provided, token)) return;
      if (!audience) this.reject('google', 'verification token mismatch');
    }

    const jwt = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!jwt) this.reject('google', 'missing OIDC bearer token');
    await this.verifyGoogleOidc(jwt, audience!);
  }

  private async verifyGoogleOidc(jwt: string, audience: string): Promise<void> {
    const [headerB64, payloadB64, signatureB64] = jwt.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      this.reject('google', 'malformed OIDC token');
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(b64urlToBuffer(headerB64).toString('utf8'));
      payload = JSON.parse(b64urlToBuffer(payloadB64).toString('utf8'));
    } catch {
      this.reject('google', 'unparseable OIDC token');
    }

    const keys = await this.googleJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) this.reject('google', `no Google signing key for kid ${header.kid}`);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    if (!verifier.verify(key, b64urlToBuffer(signatureB64))) {
      this.reject('google', 'OIDC signature mismatch');
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      this.reject('google', 'OIDC token expired');
    }
    if (payload.aud !== audience) {
      this.reject('google', 'OIDC audience mismatch');
    }
    const iss = payload.iss;
    if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
      this.reject('google', `unexpected OIDC issuer ${iss}`);
    }
  }

  private async googleJwks(): Promise<any[]> {
    const fresh =
      this.jwksCache && Date.now() - this.jwksCache.fetchedAt < JWKS_TTL_MS;
    if (fresh) return this.jwksCache!.keys;
    try {
      const res = await fetch(GOOGLE_JWKS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: any = await res.json();
      this.jwksCache = { fetchedAt: Date.now(), keys: body.keys ?? [] };
      return this.jwksCache.keys;
    } catch (error: any) {
      // A stale cache is better than failing an otherwise valid notification.
      if (this.jwksCache) return this.jwksCache.keys;
      this.reject('google', `could not fetch Google JWKS: ${error.message}`);
    }
  }
}
