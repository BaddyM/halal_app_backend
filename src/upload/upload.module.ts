import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PublicProfilePhotoController, UploadController } from './upload.controller';

@Module({
    imports: [AuthModule],
    controllers: [UploadController, PublicProfilePhotoController],
})
export class UploadModule {}
