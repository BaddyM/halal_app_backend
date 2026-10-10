import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IslamicService } from './islamic.service';
import { GeoQueryDto, PrayerTimesQueryDto } from './dto';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

// Public, non-user-specific endpoints. The mobile client still sends its JWT
// when available, but none of these read per-user data.
@Controller('islamic')
export class IslamicController {
  constructor(private readonly islamic: IslamicService, private readonly prisma: PrismaService) {}

  @Get('settings')
  settings() {
    return this.islamic.getSettings();
  }

  @Get('settings/me')
  @UseGuards(AuthGuard)
  async mySettings(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { prayerTimesEnabled: true, chaperoneMode: true },
    });
    return { ...(await this.islamic.getSettings()), ...user };
  }

  @Put('settings')
  @UseGuards(AuthGuard)
  async updateSettings(
    @Req() req: AuthedRequest,
    @Body() body: { prayerTimesEnabled?: boolean; chaperoneMode?: boolean },
  ) {
    const data: { prayerTimesEnabled?: boolean; chaperoneMode?: boolean } = {};
    if (body.prayerTimesEnabled !== undefined) data.prayerTimesEnabled = !!body.prayerTimesEnabled;
    if (body.chaperoneMode !== undefined) data.chaperoneMode = !!body.chaperoneMode;
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { prayerTimesEnabled: true, chaperoneMode: true },
    });
    return { ...(await this.islamic.getSettings()), ...user };
  }

  @Get('prayer-times')
  prayerTimes(@Query() q: PrayerTimesQueryDto) {
    return this.islamic.getPrayerTimes(
      q.lat,
      q.lng,
      q.tz,
      q.method,
      q.asrFactor ?? 1,
      q.date,
    );
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
