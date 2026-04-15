import { birthToUtcMoment } from '../astronomy/julian';
import { ephemerisService } from '../astronomy/ephemeris.service';
import type { BirthInput } from '../shared/types';
import { calcAspects, type Aspect } from './aspects.service';
import type { PlanetPosition } from '../astronomy/types';

export interface TransitResult {
  transitDate: string;
  transitPlanets: PlanetPosition[];
  natalPlanets: PlanetPosition[];
  transitAspects: Aspect[];
}

export async function calcTransits(
  natal: BirthInput,
  transitDate: string,
  transitTime: string = '12:00:00',
  transitTz: string = 'UTC'
): Promise<TransitResult> {
  const natalUtc = birthToUtcMoment(natal);
  const transitUtc = birthToUtcMoment({
    date: transitDate,
    time: transitTime,
    timezone: transitTz,
    latitude: natal.latitude,
    longitude: natal.longitude,
  });

  const geo = { latitude: natal.latitude, longitude: natal.longitude };

  const [natalChart, transitChart] = await Promise.all([
    ephemerisService.calcChart(natalUtc.julianDay, geo, 'tropical', 'LAHIRI', 'P'),
    ephemerisService.calcChart(transitUtc.julianDay, geo, 'tropical', 'LAHIRI', 'P'),
  ]);

  const natalList = natalChart.planets.map((p) => ({ planet: `N:${p.planet}`, longitude: p.longitude, speed: p.speed }));
  const transitList = transitChart.planets.map((p) => ({ planet: `T:${p.planet}`, longitude: p.longitude, speed: p.speed }));

  const transitAspects: Aspect[] = [];
  for (const t of transitList) {
    for (const n of natalList) {
      transitAspects.push(...calcAspects([t, n]));
    }
  }

  return {
    transitDate,
    transitPlanets: transitChart.planets,
    natalPlanets: natalChart.planets,
    transitAspects: transitAspects.sort((a, b) => a.orb - b.orb),
  };
}
