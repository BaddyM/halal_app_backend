import { openSync, readSync, closeSync } from 'fs';
import type { Sharp, SharpOptions } from 'sharp';

const sharpFactory = require('sharp') as (
  input: string,
  options?: SharpOptions,
) => Sharp;

const MAX_IMAGE_PIXELS = 40_000_000;
const IMAGE_FORMATS: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const AUDIO_MIME_TYPES = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
]);

function hasSignature(mimeType: string, header: Buffer): boolean {
  const ascii = (start: number, end: number) =>
    header.subarray(start, end).toString('ascii');
  const isIsoBmff = ascii(4, 8) === 'ftyp';
  const isEbml =
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3;

  if (mimeType === 'video/mp4' || mimeType === 'audio/mp4' ||
      mimeType === 'audio/m4a' || mimeType === 'audio/x-m4a') {
    return isIsoBmff;
  }
  if (mimeType === 'video/quicktime') {
    return isIsoBmff && ascii(8, 12).startsWith('qt');
  }
  if (mimeType === 'video/webm' || mimeType === 'audio/webm') {
    return isEbml;
  }
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
    return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
  }
  if (mimeType === 'audio/ogg') return ascii(0, 4) === 'OggS';
  if (mimeType === 'audio/aac') {
    return header[0] === 0xff && (header[1] & 0xf6) === 0xf0;
  }
  if (mimeType === 'audio/mpeg') {
    return (
      ascii(0, 3) === 'ID3' ||
      (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

function readHeader(filePath: string): Buffer {
  const descriptor = openSync(filePath, 'r');
  const header = Buffer.alloc(16);
  try {
    const bytesRead = readSync(descriptor, header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    closeSync(descriptor);
  }
}

export async function hasValidUploadContent(
  filePath: string,
  mimeType: string,
): Promise<boolean> {
  const expectedImageFormat = IMAGE_FORMATS[mimeType];
  if (expectedImageFormat) {
    try {
      const options = { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' as const };
      const metadata = await sharpFactory(filePath, options).metadata();
      if (metadata.format !== expectedImageFormat) return false;
      await sharpFactory(filePath, options).stats();
      return true;
    } catch {
      return false;
    }
  }

  if (mimeType.startsWith('video/') || AUDIO_MIME_TYPES.has(mimeType)) {
    return hasSignature(mimeType, readHeader(filePath));
  }
  return false;
}

export { hasSignature as hasMediaSignature };
