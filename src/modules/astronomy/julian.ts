import * as swe from 'swisseph';
import type { BirthInput, UtcMoment } from '../shared/types';

function parseTzOffset(tz: string): number {
  if (!tz || tz === 'UTC' || tz === 'Z' || tz === '+00:00') return 0;
  const match = tz.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid timezone format: "${tz}". Expected ±HH:MM`);
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (parseInt(match[2], 10) + parseInt(match[3], 10) / 60);
}

export function birthToUtcMoment(input: BirthInput): UtcMoment {
  const [year, month, day] = input.date.split('-').map(Number);
  const timeParts = input.time.split(':').map(Number);
  const hh = timeParts[0] ?? 0;
  const mm = timeParts[1] ?? 0;
  const ss = timeParts[2] ?? 0;

  const localHour = hh + mm / 60 + ss / 3600;
  const tzOffset = parseTzOffset(input.timezone);
  let utcHour = localHour - tzOffset;

  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) { utcMonth = 12; utcYear -= 1; }
      utcDay = daysInMonth(utcYear, utcMonth);
    }
  } else if (utcHour >= 24) {
    utcHour -= 24;
    utcDay += 1;
    const dim = daysInMonth(utcYear, utcMonth);
    if (utcDay > dim) { utcDay = 1; utcMonth += 1; }
    if (utcMonth > 12) { utcMonth = 1; utcYear += 1; }
  }

  const jd: number = swe.swe_julday(utcYear, utcMonth, utcDay, utcHour, swe.SE_GREG_CAL);
  return { year: utcYear, month: utcMonth, day: utcDay, hour: utcHour, julianDay: jd };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function julianDay(year: number, month: number, day: number, hour: number): number {
  return swe.swe_julday(year, month, day, hour, swe.SE_GREG_CAL);
}
