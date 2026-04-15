import { describe, it, expect } from 'vitest';
import { getNakshatra } from '../src/modules/vedic/nakshatra.service';

describe('getNakshatra()', () => {
  it('returns Ashwini for 0° Aries (sidereal)', () => {
    const nk = getNakshatra(0);
    expect(nk.name).toBe('Ashwini');
    expect(nk.pada).toBe(1);
  });

  it('returns correct nakshatra for 45° longitude', () => {
    const nk = getNakshatra(45);
    // 45° = 3rd nakshatra (Krittika) @ 40° start
    expect(nk.index).toBe(3);
    expect(nk.name).toBe('Rohini');
  });

  it('pada is always 1–4', () => {
    for (let lon = 0; lon < 360; lon += 7) {
      const nk = getNakshatra(lon);
      expect(nk.pada).toBeGreaterThanOrEqual(1);
      expect(nk.pada).toBeLessThanOrEqual(4);
    }
  });
});
