/**
 * Prayer-time calculator — a compact, dependency-free port of the well-known
 * PrayTimes.org astronomical algorithm. Pure functions; given a date, location,
 * timezone offset and method it returns the five daily prayer times plus
 * sunrise. Accurate to within a minute for typical latitudes.
 */

const DEG = Math.PI / 180;
const dsin = (d: number) => Math.sin(d * DEG);
const dcos = (d: number) => Math.cos(d * DEG);
const dtan = (d: number) => Math.tan(d * DEG);
const darcsin = (x: number) => Math.asin(x) / DEG;
const darccos = (x: number) => Math.acos(x) / DEG;
const darctan2 = (y: number, x: number) => Math.atan2(y, x) / DEG;
const darccot = (x: number) => Math.atan2(1, x) / DEG;

const fixAngle = (a: number) => ((a % 360) + 360) % 360;
const fixHour = (h: number) => ((h % 24) + 24) % 24;

export type CalcMethod = 'MWL' | 'ISNA' | 'Egypt' | 'Makkah' | 'Karachi';
export type AsrFactor = 1 | 2; // 1 = Shafii/Maliki/Hanbali, 2 = Hanafi

// Fajr / Isha twilight angles per calculation method. `ishaMinutes` (Makkah)
// uses a fixed 90-minute offset after Maghrib instead of an angle.
const METHODS: Record<CalcMethod, { fajr: number; isha: number; ishaMinutes?: number }> = {
  MWL: { fajr: 18, isha: 17 },
  ISNA: { fajr: 15, isha: 15 },
  Egypt: { fajr: 19.5, isha: 17.5 },
  Makkah: { fajr: 18.5, isha: 0, ishaMinutes: 90 },
  Karachi: { fajr: 18, isha: 18 },
};

interface SunPos {
  declination: number;
  equation: number;
}

function julian(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5
  );
}

function sunPosition(jd: number): SunPos {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const declination = darcsin(dsin(e) * dsin(L));
  const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
  const equation = q / 15 - fixHour(RA);
  return { declination, equation };
}

export interface PrayerTimesResult {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export function computePrayerTimes(
  date: Date,
  lat: number,
  lng: number,
  timezone: number,
  method: CalcMethod = 'MWL',
  asrFactor: AsrFactor = 1,
): PrayerTimesResult {
  const params = METHODS[method] ?? METHODS.MWL;
  const jDate =
    julian(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) -
    lng / (15 * 24);

  const midDay = (time: number): number => {
    const eqt = sunPosition(jDate + time).equation;
    return fixHour(12 - eqt);
  };

  // Hour-angle time for the sun reaching a given altitude `angle`.
  const sunAngleTime = (angle: number, time: number, ccw: boolean): number => {
    const decl = sunPosition(jDate + time).declination;
    const noon = midDay(time);
    const t =
      (1 / 15) *
      darccos(
        (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat)),
      );
    return noon + (ccw ? -t : t);
  };

  const asrTime = (factor: number, time: number): number => {
    const decl = sunPosition(jDate + time).declination;
    const angle = -darccot(factor + dtan(Math.abs(lat - decl)));
    return sunAngleTime(angle, time, false);
  };

  // Initial guesses (as day fractions), then one refinement pass.
  let times = {
    fajr: 5 / 24,
    sunrise: 6 / 24,
    dhuhr: 12 / 24,
    asr: 13 / 24,
    sunset: 18 / 24,
    maghrib: 18 / 24,
    isha: 18 / 24,
  };

  for (let i = 0; i < 2; i++) {
    times = {
      fajr: sunAngleTime(params.fajr, times.fajr, true) / 24,
      sunrise: sunAngleTime(0.833, times.sunrise, true) / 24,
      dhuhr: midDay(times.dhuhr) / 24,
      asr: asrTime(asrFactor, times.asr) / 24,
      sunset: sunAngleTime(0.833, times.sunset, false) / 24,
      maghrib: sunAngleTime(0.833, times.maghrib, false) / 24,
      isha: params.ishaMinutes
        ? sunAngleTime(0.833, times.isha, false) / 24
        : sunAngleTime(params.isha, times.isha, false) / 24,
    };
  }

  // Convert day-fractions → local clock hours.
  const adjust = (t: number) => t * 24 + timezone - lng / 15;

  const sunrise = adjust(times.sunrise);
  const sunset = adjust(times.sunset);
  const dhuhr = adjust(times.dhuhr) + 1 / 60; // +1 min after solar noon
  const asr = adjust(times.asr);
  const maghrib = adjust(times.maghrib);

  let fajr = adjust(times.fajr);
  let isha = params.ishaMinutes
    ? maghrib + params.ishaMinutes / 60
    : adjust(times.isha);

  // High-latitude fallback: in summer the sun may never reach the Fajr/Isha
  // twilight angle, leaving the times undefined (NaN). Approximate them using
  // the angle-based portion of the night (PrayTimes "AngleBased" method).
  const night = fixHour(sunrise - sunset); // duration sunset → next sunrise
  if (Number.isNaN(fajr)) {
    fajr = sunrise - (params.fajr / 60) * night;
  }
  if (Number.isNaN(isha) && !params.ishaMinutes) {
    isha = sunset + (params.isha / 60) * night;
  }

  const fmt = (h: number): string => {
    const total = Math.round(fixHour(h) * 60);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  return {
    fajr: fmt(fajr),
    sunrise: fmt(sunrise),
    dhuhr: fmt(dhuhr),
    asr: fmt(asr),
    maghrib: fmt(maghrib),
    isha: fmt(isha),
  };
}

const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8261;

/// Initial great-circle bearing (degrees from true north) from a location to
/// the Kaaba in Makkah.
export function qiblaBearing(lat: number, lng: number): number {
  const dLng = (KAABA_LNG - lng) * DEG;
  const phi1 = lat * DEG;
  const phi2 = KAABA_LAT * DEG;
  const y = Math.sin(dLng);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLng);
  return fixAngle((Math.atan2(y, x) / DEG));
}
