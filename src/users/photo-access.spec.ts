import { NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { UsersService } from './users.service';

function makeService(prisma: any) {
  return new UsersService(
    prisma,
    { get: () => 'test-secret' } as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('private photo access', () => {
  it('rejects a forged signature before loading the photo record', async () => {
    const prisma = { photo: { findUnique: jest.fn() } };
    const service = makeService(prisma);
    const payload = Buffer.from(JSON.stringify({ photoId: 'photo-1', viewerId: 'user-1', expiresAt: Date.now() + 60_000 })).toString('base64url');

    await expect(service.getPrivatePhotoFile('photo-1', `${payload}.forged`))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.photo.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a signed private-photo URL when there is no active grant', async () => {
    const secret = 'test-secret';
    const prisma = {
      photo: { findUnique: jest.fn().mockResolvedValue({ id: 'photo-1', userId: 'owner-1', isPrivate: true, url: '/private/photos/users/photo.jpg' }) },
      photoAccessRequest: { findUnique: jest.fn().mockResolvedValue({ status: 'denied', expiresAt: null }) },
      block: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = makeService(prisma);
    const payload = Buffer.from(JSON.stringify({ photoId: 'photo-1', viewerId: 'viewer-1', expiresAt: Date.now() + 60_000 })).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');

    await expect(service.getPrivatePhotoFile('photo-1', `${payload}.${signature}`))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects direct fetches for pending public photos', async () => {
    const prisma = {
      photo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);

    await expect(service.getPublicPhotoFile('pending-photo.jpg'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.photo.findFirst).toHaveBeenCalledWith({
      where: { url: '/uploads/photos/users/pending-photo.jpg', moderationStatus: 'approved' },
      select: { id: true, url: true },
    });
  });

  it('signs moderation previews for the authenticated admin', async () => {
    const prisma = {
      photo: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'photo-1',
          userId: 'owner-1',
          url: '/uploads/photos/users/pending.jpg',
          isPrivate: false,
          moderationStatus: 'pending',
          flags: null,
          createdAt: new Date(),
          user: { id: 'owner-1', name: 'Owner', email: 'owner@example.test' },
        }]),
      },
    };
    const service = makeService(prisma);

    const [photo] = await service.adminPhotoQueue('admin-1');
    const token = new URL(photo.url, 'https://api.example.test').searchParams.get('token');
    const [payload] = token!.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    expect(claims).toMatchObject({
      photoId: 'photo-1',
      viewerId: 'admin-1',
      admin: true,
    });
  });
});
