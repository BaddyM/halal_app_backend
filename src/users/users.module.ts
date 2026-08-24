import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './users.controller';
import { UsersContractController } from './contract.controller';
import { UsersService } from './users.service';

@Module({
    imports: [AuthModule],
    controllers: [UsersController, UsersContractController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
