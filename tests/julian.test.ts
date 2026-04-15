import { describe, it, expect, vi } from 'vitest';

// Mock swisseph native addon so tests run without a compiled binary
vi.mock('swisseph', () => ({
  SE_GREG_CAL: 1,
  swe_julday: (year: number, month: number, day: number, hour: number) => {
    // Simplified Julian Day formula (good enough for testing)
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return (
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045 +
      (hour - 12) / 24
    );
  },
}));

import { julianDay } from '../src/modules/astronomy/julian';

describe('julianDay()', () => {
  it('calculates J2000.0 epoch correctly', () => {
    const jd = julianDay(2000, 1, 1, 12.0);
    expect(jd).toBeCloseTo(2451545.0, 0);
  });

  it('returns a reasonable JD for 1990-06-15', () => {
    const jd = julianDay(1990, 6, 15, 12.0);
    expect(jd).toBeGreaterThan(2447000);
    expect(jd).toBeLessThan(2450000);
  });
});
