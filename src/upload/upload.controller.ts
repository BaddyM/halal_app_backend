import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_SIZE = 5 * 1024 * 1024;

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
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
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

    const url = `/uploads/photos/users/${file.filename}`;
    const photo = await this.prisma.photo.create({
      data: { userId: req.user.userId, url, isPrimary: true, position: 0 },
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
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
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
  async uploadChatMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/photos/chat/${file.filename}` };
  }
}
