import { IsInt, IsString, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { TasbihVisibility } from '@prisma/client';

// ────────────────────────────────────────────────────────────────
// REQUEST DTOs
// ────────────────────────────────────────────────────────────────

export class AddTasbihDto {
  @IsInt()
  @Min(1)
  @Max(1000)
  count: number;

  @IsString()
  @IsOptional()
  intention?: string;
}

export class UpdateUserSettingsDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  dailyGoal?: number;

  @IsEnum(['private', 'matchesOnly', 'public'])
  @IsOptional()
  visibility?: TasbihVisibility;

  @IsOptional()
  notificationsEnabled?: boolean;

  @IsOptional()
  soundEnabled?: boolean;

  @IsOptional()
  hapticEnabled?: boolean;
}

export class UpdateSystemSettingsDto {
  @IsOptional()
  badgesEnabled?: boolean;

  @IsOptional()
  streaksEnabled?: boolean;

  @IsOptional()
  leaderboardEnabled?: boolean;

  @IsOptional()
  dailyGoalEnabled?: boolean;

  @IsOptional()
  encouragementEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  defaultDailyGoal?: number;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  minStreakDays?: number;

  @IsEnum(['global', 'country', 'city', 'matches'])
  @IsOptional()
  leaderboardScope?: string;

  @IsOptional()
  encouragementMessages?: string[];
}

export class CreateBadgeDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['milestone', 'streak', 'consistency', 'special', 'achievement'])
  badgeType: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  threshold?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  streakDays?: number;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  requiresPremium?: boolean;
}

// ────────────────────────────────────────────────────────────────
// RESPONSE DTOs
// ────────────────────────────────────────────────────────────────

export class TasbihSessionDto {
  id: string;
  userId: string;
  count: number;
  intention?: string;
  sessionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class TasbihStatisticsDto {
  todayCount: number;
  dailyGoal: number;
  lifetimeCount: number;
  currentStreak: number;
  longestStreak: number;
  earnedBadges: number;
  nextMilestone: number;
}

export class TasbihDailyDto {
  date: string;
  count: number;
  metGoal: boolean;
}

export class TasbihWeeklyDto {
  week: string;
  total: number;
  days: TasbihDailyDto[];
  avgDaily: number;
}

export class TasbihMonthlyDto {
  month: string;
  total: number;
  weeks: TasbihWeeklyDto[];
  avgDaily: number;
  consistency: number;
}

export class TasbihLifetimeDto {
  lifetimeTotal: number;
  totalDaysActive: number;
  totalDaysMetGoal: number;
  currentStreak: number;
  longestStreak: number;
  badgesEarned: number;
  averageDailyCount: number;
}

export class UserBadgeDto {
  id: string;
  name: string;
  description?: string;
  badgeType: string;
  iconUrl?: string;
  color?: string;
  earnedAt?: Date;
  progress: number;
  status: string;
}

export class TasbihBadgeDto {
  id: string;
  name: string;
  description?: string;
  badgeType: string;
  threshold?: number;
  streakDays?: number;
  iconUrl?: string;
  color?: string;
  isActive: boolean;
  requiresPremium: boolean;
}

export class TasbihUserSettingsDto {
  userId: string;
  visibility: TasbihVisibility;
  dailyGoal: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  lifetimeTotal: number;
}

export class LeaderboardEntryDto {
  rank: number;
  userId: string;
  lifetimeCount: number;
  currentStreak: number;
  score: number;
}
