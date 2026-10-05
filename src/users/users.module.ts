import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './users.controller';
import { UsersContractController, LikesContractController, PassesContractController } from './contract.controller';
import { UsersService } from './users.service';
import { AdminGuard } from 'src/admin/admin.guard';
import {
    AdminPhotoAccessController,
    AdminPhotoModerationController,
    AdminPhotoRequestsController,
    PhotoAccessController,
    PrivatePhotoAccessController,
    PrivatePhotoMediaController,
} from './photo-access.controller';
import { AccountDeletionController, AdminAccountDeletionController } from './account-deletion.controller';

@Module({
    imports: [AuthModule],
    controllers: [
        UsersController,
        UsersContractController,
        LikesContractController,
        PassesContractController,
        PhotoAccessController,
        PrivatePhotoAccessController,
        PrivatePhotoMediaController,
        AdminPhotoAccessController,
        AdminPhotoModerationController,
        AdminPhotoRequestsController,
        AccountDeletionController,
        AdminAccountDeletionController,
    ],
    providers: [UsersService, AdminGuard],
    exports: [UsersService],
})
export class UsersModule {}
