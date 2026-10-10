import { PrismaService } from 'src/prisma/prisma.service';
import { IslamicService } from './islamic.service';

describe('IslamicService prayer dates', () => {
  const settings = {
    calcMethod: 'MWL',
    ramadanMode: false,
    prayerTimesEnabled: true,
    qiblaEnabled: true,
    dailyContentEnabled: true,
    tasbihEnabled: true,
  };

  function service() {
    const prisma = {
      islamicSetting: {
        upsert: jest.fn().mockResolvedValue(settings),
      },
    } as unknown as PrismaService;
    return new IslamicService(prisma);
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the requested local calendar date for future prayer schedules', async () => {
    const result = await service().getPrayerTimes(
      0.3476,
      32.5825,
      3,
      undefined,
      1,
      '2026-10-10',
    );

    expect(result.date).toBe('2026-10-10T00:00:00.000Z');
    expect(result.times.fajr).toMatch(/^\d{2}:\d{2}$/);
  });

  it('uses the timezone-local day rather than the UTC day by default', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T23:30:00.000Z'));

    const result = await service().getPrayerTimes(0.3476, 32.5825, 3);

    expect(result.date).toBe('2026-10-09T00:00:00.000Z');
  });
});
