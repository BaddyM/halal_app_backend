import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const production =
    config.get<string>('NODE_ENV')?.toLowerCase() === 'production' ||
    config.get<string>('MODE')?.toLowerCase() === 'production';
  const secret = config.get<string>('JWT_SECRET') ?? config.get<string>('SYSTEM_SECRET');
  if (secret && (!production || (secret.length >= 32 && !['change-me', 'dev-secret'].includes(secret.toLowerCase())))) {
    return secret;
  }
  if (production) {
    throw new Error('JWT_SECRET must be configured with a strong value in production');
  }

  return 'dev-secret';
}

export function getWaliLinkSecret(config: ConfigService): string {
  const secret = config.get<string>('WALI_LINK_SECRET');
  if (!secret) return getJwtSecret(config);
  const production =
    config.get<string>('NODE_ENV')?.toLowerCase() === 'production' ||
    config.get<string>('MODE')?.toLowerCase() === 'production';
  if (production && (secret.length < 32 || ['change-me', 'dev-secret'].includes(secret.toLowerCase()))) {
    throw new Error('WALI_LINK_SECRET must be configured with a strong value in production');
  }
  return secret;
}
