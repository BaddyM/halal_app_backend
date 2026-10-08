import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { extensionForMime, verificationDir } from './storage-paths';
import { hasValidUploadContent } from './content-validation';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
import { randomUUID } from 'crypto';
const MAX_SIZE = 5 * 1024 * 1024;
const VERIFICATION_MAX_SIZE = 50 * 1024 * 1024;
const VERIFICATION_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = './uploads/photos/users';
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extensionForMime(file.mimetype)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPG, PNG or WEBP images allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_SIZE },
    }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!(await hasValidUploadContent(file.path, file.mimetype))) {
      unlinkSync(file.path);
      throw new BadRequestException(
        'Uploaded file contents do not match an allowed image type',
      );
    }

    const url = `/uploads/photos/users/${file.filename}`;
    const photo = await this.prisma.photo.create({
      data: { userId: req.user.userId, url, isPrimary: true, moderationStatus: 'pending', position: 0 },
    });

    await this.prisma.profile.upsert({
      where: { userId: req.user.userId },
      update: { primaryImageUrl: url },
      create: { userId: req.user.userId, primaryImageUrl: url },
    });

    return { id: photo.id, filename: file.filename, url };
  }

  // Upload media for a chat message. Unlike /upload/photo this does NOT touch
  // the profile gallery/primary — it just stores the file and returns its URL,
  // which the client then attaches to a (premium) image/voice message.
  @Post('chat-media')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = './uploads/photos/chat';
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extensionForMime(file.mimetype)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        // Chat media allows images (photo messages) and audio (voice notes).
        const ok =
          ALLOWED_MIME.includes(file.mimetype) ||
          file.mimetype.startsWith('audio/');
        if (!ok) {
          return cb(
            new BadRequestException('Only image or audio files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_SIZE },
    }),
  )
  async uploadChatMedia(@Req() req: AuthedRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!(await hasValidUploadContent(file.path, file.mimetype))) {
      unlinkSync(file.path);
      throw new BadRequestException(
        'Uploaded file contents do not match an allowed image or audio type',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: req.user.userId }, select: { plan: true } });
    if (!user || user.plan === 'basic') {
      unlinkSync(file.path);
      throw new ForbiddenException('Photo and voice messages are a Premium feature.');
    }
    return { url: `/uploads/photos/chat/${file.filename}` };
  }

  @Post('verification-document')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        kind: { type: 'string', enum: ['front', 'back', 'selfie', 'video'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file, cb) => {
          const dest = verificationDir(req.user.userId);
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extensionForMime(file.mimetype)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!VERIFICATION_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException('Verification files must be JPG, PNG, WEBP, MP4, MOV or WEBM'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: VERIFICATION_MAX_SIZE },
    }),
  )
  async uploadVerificationDocument(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') kind: string,
  ) {
    if (!['front', 'back', 'selfie', 'video'].includes(kind)) {
      if (file?.path) try { unlinkSync(file.path); } catch (_) {}
      throw new BadRequestException('Invalid verification document kind');
    }
    if (!file) throw new BadRequestException('No verification file uploaded');
    if (!(await hasValidUploadContent(file.path, file.mimetype))) {
      unlinkSync(file.path);
      throw new BadRequestException(
        'Uploaded file contents do not match the declared image or video type',
      );
    }
    const isVideo = file.mimetype.startsWith('video/');
    if ((kind === 'front' || kind === 'back' || kind === 'selfie') && isVideo) {
      try { unlinkSync(file.path); } catch (_) {}
      throw new BadRequestException(`${kind} must be an image`);
    }
    if (kind === 'video' && !isVideo) {
      try { unlinkSync(file.path); } catch (_) {}
      throw new BadRequestException('Holding-document proof must be a video');
    }
    return {
      documentId: file.filename.split('.')[0],
      kind,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    };
  }
}

@Controller('uploads/photos/users')
export class PublicProfilePhotoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':fileName')
  async servePublicProfilePhoto(@Param('fileName') fileName: string, @Res() response: Response) {
    if (!/^[A-Za-z0-9._-]+$/.test(fileName)) throw new NotFoundException('Photo not found');
    const url = `/uploads/photos/users/${fileName}`;
    const photo = await this.prisma.photo.findFirst({
      where: { url, moderationStatus: 'approved' },
      select: { id: true, url: true },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    const filePath = join(process.cwd(), 'uploads', 'photos', 'users', fileName);
    if (!existsSync(filePath)) throw new NotFoundException('Photo not found');
    response.setHeader('Cache-Control', 'public, max-age=300');
    const ext = extname(filePath).toLowerCase();
    response.setHeader('Content-Type', ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
    return response.sendFile(filePath);
  }
}
