import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TasbihService } from './tasbih.service';
import { TasbihController } from './tasbih.controller';
import { TasbihAggregationProcessor } from './processors/tasbih-aggregation.processor';
import { TasbihBadgesProcessor } from './processors/tasbih-badges.processor';
import { TasbihLeaderboardProcessor } from './processors/tasbih-leaderboard.processor';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'tasbih-aggregation' },
      { name: 'tasbih-badges' },
      { name: 'tasbih-leaderboard' },
    ),
    AuthModule,
  ],
  providers: [
    TasbihService,
    TasbihAggregationProcessor,
    TasbihBadgesProcessor,
    TasbihLeaderboardProcessor,
  ],
  controllers: [TasbihController],
  exports: [TasbihService],
})
export class TasbihModule {}
