import { Module } from '@nestjs/common';
import { DailyReportService } from './daily_report.service';
import { DailyReportController } from './daily_report.controller';

@Module({
  controllers: [DailyReportController],
  providers: [DailyReportService],
})
export class DailyReportModule {}
