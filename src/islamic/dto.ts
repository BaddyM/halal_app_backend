import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class GeoQueryDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng!: number;
}

export class PrayerTimesQueryDto extends GeoQueryDto {
  // Timezone offset in hours (e.g. 1, -5, 3.5). Defaults to lng/15 if omitted.
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-12) @Max(14) tz?: number;

  @IsOptional() @IsIn(['MWL', 'ISNA', 'Egypt', 'Makkah', 'Karachi']) method?:
    | 'MWL'
    | 'ISNA'
    | 'Egypt'
    | 'Makkah'
    | 'Karachi';

  // 1 = Shafii/Maliki/Hanbali, 2 = Hanafi (madhab-aware Asr).
  @IsOptional() @Type(() => Number) @IsIn([1, 2]) asrFactor?: 1 | 2;
}
