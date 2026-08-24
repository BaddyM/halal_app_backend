import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  computePrayerTimes,
  qiblaBearing,
  CalcMethod,
  AsrFactor,
  PrayerTimesResult,
} from './prayer-times';
import { DUAS, HADITHS, dayOfYear } from './daily-content';

@Injectable()
export class IslamicService {
  constructor(private readonly prisma: PrismaService) {}

  /// Global feature toggles (singleton row id=1). Created on first read so the
  /// dashboard always has a row to edit.
  async getSettings() {
    const settings = await this.prisma.islamicSetting.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    return {
      prayerTimesEnabled: settings.prayerTimesEnabled,
      qiblaEnabled: settings.qiblaEnabled,
      dailyContentEnabled: settings.dailyContentEnabled,
      tasbihEnabled: settings.tasbihEnabled,
      ramadanMode: settings.ramadanMode,
      calcMethod: settings.calcMethod,
    };
  }

  async getPrayerTimes(
    lat: number,
    lng: number,
    tz?: number,
    method?: CalcMethod,
    asrFactor: AsrFactor = 1,
  ) {
    const settings = await this.getSettings();
    const tzOffset = tz ?? Math.round(lng / 15);
    const calcMethod = (method ?? settings.calcMethod) as CalcMethod;
    const now = new Date();
    const times = computePrayerTimes(now, lat, lng, tzOffset, calcMethod, asrFactor);

    return {
      date: now.toISOString(),
      timezone: tzOffset,
      method: calcMethod,
      asrFactor,
      ramadanMode: settings.ramadanMode,
      times,
      // The next upcoming prayer (by local clock) for "time until" UIs.
      next: this.nextPrayer(times, tzOffset),
    };
  }

  private nextPrayer(
    times: PrayerTimesResult,
    tz: number,
  ): { name: string; time: string } | null {
    const order: Array<keyof PrayerTimesResult> = [
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ];
    // Current local time in minutes.
    const nowUtc = new Date();
    const localMinutes =
      (nowUtc.getUTCHours() + tz) * 60 + nowUtc.getUTCMinutes();
    const norm = ((localMinutes % 1440) + 1440) % 1440;
    for (const name of order) {
      const [h, m] = times[name].split(':').map(Number);
      if (h * 60 + m > norm) return { name, time: times[name] };
    }
    return { name: 'fajr', time: times.fajr }; // wraps to tomorrow's Fajr
  }

  getQibla(lat: number, lng: number) {
    return {
      bearing: Math.round(qiblaBearing(lat, lng) * 100) / 100,
      // Bearing is measured clockwise from true north toward the Kaaba.
      from: { lat, lng },
      kaaba: { lat: 21.4225, lng: 39.8261 },
    };
  }

  getDaily() {
    const idx = dayOfYear(new Date());
    return {
      date: new Date().toISOString().slice(0, 10),
      dua: DUAS[idx % DUAS.length],
      hadith: HADITHS[idx % HADITHS.length],
    };
  }

  getAdhkar(period?: string) {
    const idx = dayOfYear(new Date());
    const dua = DUAS[(idx + (period?.length ?? 0)) % DUAS.length];
    const hadith = HADITHS[(idx + 1) % HADITHS.length];
    return { period: period ?? 'general', dua, hadith };
  }
}
