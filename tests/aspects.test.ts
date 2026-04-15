import { describe, it, expect } from 'vitest';
import { calcAspects } from '../src/modules/western/aspects.service';

describe('calcAspects()', () => {
  it('finds a conjunction when two planets are within 8°', () => {
    const planets = [
      { planet: 'Sun', longitude: 10, speed: 1 },
      { planet: 'Moon', longitude: 16, speed: 13 },
    ];
    const aspects = calcAspects(planets);
    expect(aspects.some((a) => a.aspectName === 'Conjunction')).toBe(true);
  });

  it('finds an opposition at 180°', () => {
    const planets = [
      { planet: 'Sun', longitude: 0, speed: 1 },
      { planet: 'Saturn', longitude: 180, speed: 0.03 },
    ];
    const aspects = calcAspects(planets);
    expect(aspects.some((a) => a.aspectName === 'Opposition')).toBe(true);
  });

  it('finds a trine at 120°', () => {
    const planets = [
      { planet: 'Jupiter', longitude: 30, speed: 0.2 },
      { planet: 'Mars', longitude: 150, speed: 0.5 },
    ];
    const aspects = calcAspects(planets);
    expect(aspects.some((a) => a.aspectName === 'Trine')).toBe(true);
  });
});
