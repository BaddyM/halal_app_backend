import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TasbihService } from './tasbih.service';
import { TasbihController } from './tasbih.controller';
import { TasbihAdminAliasController } from './tasbih-admin-alias.controller';
import { TasbihAggregationProcessor } from './processors/tasbih-aggregation.processor';
import { TasbihBadgesProcessor } from './processors/tasbih-badges.processor';
import { TasbihLeaderboardProcessor } from './processors/tasbih-leaderboard.processor';
import { AuthModule } from 'src/auth/auth.module';
import { TasbihCompleteService } from './tasbih-complete.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { MailModule } from 'src/mail/mail.module';

import { AdminTasbihController } from './tasbih-admin.controller';

import { TasbihApiController } from './tasbih-api.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'tasbih-aggregation' },
      { name: 'tasbih-badges' },
      { name: 'tasbih-leaderboard' },
    ),
    AuthModule,
    PrismaModule,
    RealtimeModule,
    MailModule,
  ],
  providers: [
    TasbihService,
      TasbihCompleteService,
    TasbihAggregationProcessor,
    TasbihBadgesProcessor,
    TasbihLeaderboardProcessor,
  ],
  controllers: [TasbihController, TasbihAdminAliasController, AdminTasbihController, TasbihApiController],
  exports: [TasbihService, TasbihCompleteService],
})
export class TasbihModule {}
