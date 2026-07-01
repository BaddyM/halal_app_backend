import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { TasbihService } from '../tasbih.service';

@Processor('tasbih-badges')
export class TasbihBadgesProcessor {
  constructor(private tasbihService: TasbihService) {}

  @Process('check-badges')
  async checkBadges(job: Job) {
    const { userId } = job.data;
    await this.tasbihService.checkAndAwardBadges(userId);
  }

  @Process('check-streak-badge')
  async checkStreakBadge(job: Job) {
    const { userId, streakDays } = job.data;
    // Service already handles this internally
    await this.tasbihService.checkAndAwardBadges(userId);
  }
}
