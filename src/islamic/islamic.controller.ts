import { Controller, Get, Query } from '@nestjs/common';
import { IslamicService } from './islamic.service';
import { GeoQueryDto, PrayerTimesQueryDto } from './dto';

// Public, non-user-specific endpoints. The mobile client still sends its JWT
// when available, but none of these read per-user data.
@Controller('islamic')
export class IslamicController {
  constructor(private readonly islamic: IslamicService) {}

  @Get('settings')
  settings() {
    return this.islamic.getSettings();
  }

  @Get('prayer-times')
  prayerTimes(@Query() q: PrayerTimesQueryDto) {
    return this.islamic.getPrayerTimes(q.lat, q.lng, q.tz, q.method, q.asrFactor ?? 1);
  }

  @Get('qibla')
  qibla(@Query() q: GeoQueryDto) {
    return this.islamic.getQibla(q.lat, q.lng);
  }

  @Get('daily')
  daily() {
    return this.islamic.getDaily();
  }

  @Get('adhkar')
  adhkar(@Query('period') period?: string) {
    return this.islamic.getAdhkar(period);
  }
}
