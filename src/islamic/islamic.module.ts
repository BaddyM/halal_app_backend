import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { IslamicController } from './islamic.controller';
import { IslamicService } from './islamic.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [IslamicController],
  providers: [IslamicService],
})
export class IslamicModule {}
