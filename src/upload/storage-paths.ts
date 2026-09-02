import { join } from 'path';

/// Root for files that must NEVER be reachable over HTTP.
///
/// `uploads/` is mounted by ServeStaticModule at `/uploads/`, so anything
/// written under it is world-readable to anyone who knows the URL. Identity
/// documents (ID front/back, selfies, holding-document video) are PII and are
/// therefore stored here instead, and only ever leave the server through the
/// authenticated admin download route.
export const PRIVATE_UPLOAD_ROOT = join(process.cwd(), 'private-uploads');

export function verificationDir(userId: string): string {
  return join(PRIVATE_UPLOAD_ROOT, 'verification', userId);
}

/// Extension for a file, derived from the mimetype we validated rather than
/// from the client-supplied filename. Taking it from `originalname` lets a
/// caller declare `image/jpeg` while naming the file `x.html`, which then gets
/// served as HTML from a public path — stored XSS.
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.weba',
  'audio/ogg': '.ogg',
};

export function extensionForMime(mimetype: string): string {
  return MIME_EXTENSIONS[mimetype?.toLowerCase()] ?? '.bin';
}
