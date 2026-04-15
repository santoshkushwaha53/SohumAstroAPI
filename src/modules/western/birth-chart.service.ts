import { ephemerisService } from '../astronomy/ephemeris.service';
import { birthToUtcMoment } from '../astronomy/julian';
import type { BirthInput } from '../shared/types';
import type { EphemerisResult } from '../astronomy/types';
import { calcAspects, type Aspect } from './aspects.service';

export interface WesternBirthChart {
  input: BirthInput;
  julianDay: number;
  chart: EphemerisResult;
  aspects: Aspect[];
}

export async function calcWesternBirthChart(
  input: BirthInput,
  houseSystem: string = 'P'
): Promise<WesternBirthChart> {
  const utc = birthToUtcMoment(input);
  const geo = { latitude: input.latitude, longitude: input.longitude };

  const chart = await ephemerisService.calcChart(
    utc.julianDay,
    geo,
    'tropical',
    'LAHIRI',
    houseSystem
  );

  const aspects = calcAspects(
    chart.planets.map((p) => ({ planet: p.planet, longitude: p.longitude, speed: p.speed }))
  );

  return { input, julianDay: utc.julianDay, chart, aspects };
}
