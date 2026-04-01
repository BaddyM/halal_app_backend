import { PartialType } from '@nestjs/swagger';
import { CreateDailyReportDto } from './create-daily_report.dto';

export class UpdateDailyReportDto extends PartialType(CreateDailyReportDto) {}
