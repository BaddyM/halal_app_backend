import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { MatchesController } from './matches.controller';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [MatchesController],
})
export class MatchesModule {}
