import { Module } from '@nestjs/common';
import { TargetService } from './target.service';
import { TargetController } from './target.controller';
import { DashboardService } from 'src/dashboard/dashboard.service';

@Module({
  controllers: [TargetController],
  providers: [TargetService, DashboardService],
})
export class TargetModule {}
