import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extensionForMime } from './storage-paths';

export const PHOTO_DEST = './uploads/photos/users';
export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const PHOTO_MAX_SIZE = 5 * 1024 * 1024;

/// Shared multer options for user photo uploads. Used by both the single
/// avatar upload (`/upload/photo`) and the gallery endpoints (`/users/me/photos`)
/// so storage location, naming and validation stay consistent.
export const photoMulterOptions = {
    storage: diskStorage({
        destination: (_req: any, _file: any, cb: any) => {
            if (!existsSync(PHOTO_DEST)) mkdirSync(PHOTO_DEST, { recursive: true });
            cb(null, PHOTO_DEST);
        },
        filename: (_req: any, file: any, cb: any) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${unique}${extensionForMime(file.mimetype)}`);
        },
    }),
    fileFilter: (_req: any, file: any, cb: any) => {
        if (!PHOTO_ALLOWED_MIME.includes(file.mimetype)) {
            return cb(new BadRequestException('Only JPG, PNG or WEBP images allowed'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: PHOTO_MAX_SIZE },
};

export function publicPhotoUrl(filename: string): string {
    return `/uploads/photos/users/${filename}`;
}
