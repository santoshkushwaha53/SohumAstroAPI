import { birthToUtcMoment } from '../astronomy/julian';
import { ephemerisService } from '../astronomy/ephemeris.service';
import type { BirthInput } from '../shared/types';
import { calcAspects, type Aspect } from './aspects.service';
import type { PlanetPosition } from '../astronomy/types';

export interface SynastryResult {
  person1: string;
  person2: string;
  crossAspects: Aspect[];
  person1Planets: PlanetPosition[];
  person2Planets: PlanetPosition[];
}

export async function calcSynastry(
  input1: BirthInput & { label?: string },
  input2: BirthInput & { label?: string }
): Promise<SynastryResult> {
  const utc1 = birthToUtcMoment(input1);
  const utc2 = birthToUtcMoment(input2);

  const [chart1, chart2] = await Promise.all([
    ephemerisService.calcChart(utc1.julianDay, { latitude: input1.latitude, longitude: input1.longitude }, 'tropical', 'LAHIRI', 'P'),
    ephemerisService.calcChart(utc2.julianDay, { latitude: input2.latitude, longitude: input2.longitude }, 'tropical', 'LAHIRI', 'P'),
  ]);

  const p1List = chart1.planets.map((p) => ({ planet: `P1:${p.planet}`, longitude: p.longitude, speed: p.speed }));
  const p2List = chart2.planets.map((p) => ({ planet: `P2:${p.planet}`, longitude: p.longitude, speed: p.speed }));

  const crossAspects: Aspect[] = [];
  for (const p1 of p1List) {
    for (const p2 of p2List) {
      crossAspects.push(...calcAspects([p1, p2]));
    }
  }

  return {
    person1: input1.label ?? 'Person 1',
    person2: input2.label ?? 'Person 2',
    crossAspects: crossAspects.sort((a, b) => a.orb - b.orb),
    person1Planets: chart1.planets,
    person2Planets: chart2.planets,
  };
}
