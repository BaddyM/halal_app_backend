import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { TasbihService } from '../tasbih.service';

@Processor('tasbih-aggregation')
export class TasbihAggregationProcessor {
  constructor(private tasbihService: TasbihService) {}

  @Process('aggregate-daily')
  async aggregateDaily(job: Job) {
    const { userId, date } = job.data;
    await this.tasbihService.aggregateDaily(userId, new Date(date));
  }
}
