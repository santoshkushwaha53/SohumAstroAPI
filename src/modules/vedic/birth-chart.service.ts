import { ephemerisService } from '../astronomy/ephemeris.service';
import { birthToUtcMoment } from '../astronomy/julian';
import type { BirthInput } from '../shared/types';
import type { AyanamsaName, EphemerisResult } from '../astronomy/types';
import { getNakshatra, type NakshatraResult } from './nakshatra.service';

export interface VedicBirthChart {
  input: BirthInput;
  julianDay: number;
  ayanamsa: number;
  ayanamsaName: AyanamsaName;
  chart: EphemerisResult;
  moonNakshatra: NakshatraResult;
  ascendantNakshatra: NakshatraResult;
}

export async function calcVedicBirthChart(
  input: BirthInput,
  ayanamsa: AyanamsaName = 'LAHIRI',
  houseSystem: string = 'W'
): Promise<VedicBirthChart> {
  const utc = birthToUtcMoment(input);
  const geo = { latitude: input.latitude, longitude: input.longitude };

  const chart = await ephemerisService.calcChart(
    utc.julianDay,
    geo,
    'sidereal',
    ayanamsa,
    houseSystem
  );

  const ayanamsaValue = ephemerisService.getAyanamsa(utc.julianDay, ayanamsa);

  const moonPlanet = chart.planets.find((p) => p.planet === 'Moon');
  const moonNakshatra = getNakshatra(moonPlanet?.longitude ?? 0);
  const ascendantNakshatra = getNakshatra(chart.houses.ascendant);

  return {
    input,
    julianDay: utc.julianDay,
    ayanamsa: ayanamsaValue,
    ayanamsaName: ayanamsa,
    chart,
    moonNakshatra,
    ascendantNakshatra,
  };
}
