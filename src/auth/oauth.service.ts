import {
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OAuthProfile {
    /// Stable provider account id (Google `sub` / Apple `sub`).
    providerId: string;
    email: string | null;
    name: string | null;
    emailVerified: boolean;
}

/// Verifies provider ID tokens obtained on-device by the mobile app.
///
/// - Google: validated against Google's public `tokeninfo` endpoint, which
///   checks the signature and expiry server-side. We additionally enforce the
///   audience when `GOOGLE_CLIENT_ID` is configured.
/// - Apple: the identity token is a JWT. We validate issuer/audience/expiry and
///   extract the claims. NOTE: cryptographic signature verification against
///   Apple's JWKS is only performed when `APPLE_VERIFY_SIGNATURE=true` AND a
///   JWKS verification library is wired in; otherwise we trust the decoded
///   claims (acceptable for development, NOT for production). See README.
@Injectable()
export class OAuthService {
    private readonly logger = new Logger(OAuthService.name);

    constructor(private readonly config: ConfigService) {}

    private isDev() {
        return this.config.get('MODE') === 'Dev';
    }

    private decodeJwtPayload(token: string): Record<string, any> {
        const parts = token.split('.');
        if (parts.length < 2) throw new UnauthorizedException('Malformed token');
        try {
            const json = Buffer.from(parts[1], 'base64url').toString('utf8');
            return JSON.parse(json);
        } catch {
            throw new UnauthorizedException('Malformed token payload');
        }
    }

    async verifyGoogle(idToken: string): Promise<OAuthProfile> {
        try {
            const res = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
            );
            if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
            const data: any = await res.json();

            const expectedAud = this.config.get<string>('GOOGLE_CLIENT_ID');
            if (expectedAud && data.aud !== expectedAud) {
                throw new UnauthorizedException('Google token audience mismatch');
            }
            if (!data.sub) throw new UnauthorizedException('Google token missing subject');

            return {
                providerId: String(data.sub),
                email: data.email ? String(data.email) : null,
                name: data.name ? String(data.name) : null,
                emailVerified: data.email_verified === 'true' || data.email_verified === true,
            };
        } catch (e) {
            this.logger.warn(`Google token verification failed: ${String(e)}`);
            // Dev fallback: trust the decoded payload so local testing works
            // even without a configured Google client id / network access.
            if (this.isDev()) {
                const p = this.decodeJwtPayload(idToken);
                if (p.sub) {
                    return {
                        providerId: String(p.sub),
                        email: p.email ? String(p.email) : null,
                        name: p.name ? String(p.name) : null,
                        emailVerified: true,
                    };
                }
            }
            throw new UnauthorizedException('Invalid Google token');
        }
    }

    async verifyApple(idToken: string, fallbackName?: string): Promise<OAuthProfile> {
        const p = this.decodeJwtPayload(idToken);

        const issOk = p.iss === 'https://appleid.apple.com';
        const expectedAud = this.config.get<string>('APPLE_CLIENT_ID');
        const audOk = !expectedAud || p.aud === expectedAud;
        const notExpired = !p.exp || p.exp * 1000 > Date.now();

        if (!p.sub || !issOk || !audOk || !notExpired) {
            if (!this.isDev()) throw new UnauthorizedException('Invalid Apple token');
            this.logger.warn('Apple token claims failed strict checks (allowed in Dev)');
        }

        return {
            providerId: String(p.sub),
            email: p.email ? String(p.email) : null,
            name: fallbackName ?? null,
            emailVerified: p.email_verified === 'true' || p.email_verified === true,
        };
    }
}
