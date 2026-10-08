import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Sharp, SharpOptions } from 'sharp';
import { hasMediaSignature, hasValidUploadContent } from './content-validation';

const sharpFactory = require('sharp') as (
  input:
    | string
    | {
        create: {
          width: number;
          height: number;
          channels: 3;
          background: string;
        };
      },
  options?: SharpOptions,
) => Sharp;

describe('uploaded media content validation', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'halal-upload-test-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('accepts fully decodable images and rejects mislabeled or corrupt images', async () => {
    const pngPath = join(directory, 'valid.png');
    await sharpFactory({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toFile(pngPath);
    const corruptPath = join(directory, 'corrupt.png');
    writeFileSync(corruptPath, Buffer.from('not an image'));

    await expect(hasValidUploadContent(pngPath, 'image/png')).resolves.toBe(true);
    await expect(hasValidUploadContent(pngPath, 'image/jpeg')).resolves.toBe(
      false,
    );
    await expect(
      hasValidUploadContent(corruptPath, 'image/png'),
    ).resolves.toBe(false);
  });

  it('matches declared video and voice MIME types to their container signatures', () => {
    const mp4Header = Buffer.alloc(16);
    mp4Header.write('ftyp', 4);
    mp4Header.write('isom', 8);
    const quicktimeHeader = Buffer.alloc(16);
    quicktimeHeader.write('ftyp', 4);
    quicktimeHeader.write('qt  ', 8);
    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    const wavHeader = Buffer.alloc(12);
    wavHeader.write('RIFF', 0);
    wavHeader.write('WAVE', 8);

    expect(hasMediaSignature('video/mp4', mp4Header)).toBe(true);
    expect(hasMediaSignature('video/quicktime', quicktimeHeader)).toBe(true);
    expect(hasMediaSignature('video/webm', webmHeader)).toBe(true);
    expect(hasMediaSignature('audio/wav', wavHeader)).toBe(true);
    expect(hasMediaSignature('video/mp4', Buffer.from('not a video'))).toBe(
      false,
    );
    expect(hasMediaSignature('audio/wav', mp4Header)).toBe(false);
  });
});
