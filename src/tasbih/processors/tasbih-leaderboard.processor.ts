import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';

@Processor('tasbih-leaderboard')
export class TasbihLeaderboardProcessor {
  constructor(private prisma: PrismaService) {}

  @Process('update-leaderboard')
  async updateLeaderboard(job: Job) {
    const { userId } = job.data;

    // Get user's stats
    const settings = await this.prisma.tasbihUserSettings.findUnique({
      where: { userId },
    });

    if (!settings) return;

    const streak = await this.prisma.tasbihStreak.findUnique({
      where: { userId },
    });

    // Update global leaderboard
    const score = settings.lifetimeTotal + (streak?.currentStreak || 0) * 100;

    // Count rank
    const higherScores = await this.prisma.tasbihLeaderboard.count({
      where: {
        scope: 'global',
        score: { gt: score },
      },
    });

    await this.prisma.tasbihLeaderboard.upsert({
      where: {
        userId_scope: {
          userId,
          scope: 'global',
        },
      },
      create: {
        userId,
        scope: 'global',
        rank: higherScores + 1,
        lifetimeCount: settings.lifetimeTotal,
        currentStreak: streak?.currentStreak || 0,
        score,
      },
      update: {
        rank: higherScores + 1,
        lifetimeCount: settings.lifetimeTotal,
        currentStreak: streak?.currentStreak || 0,
        score,
      },
    });
  }
}
