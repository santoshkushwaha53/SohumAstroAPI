export type AstrologyMode = 'tropical' | 'sidereal';

export type AyanamsaName =
  | 'LAHIRI'
  | 'RAMAN'
  | 'KRISHNAMURTI'
  | 'FAGAN_BRADLEY'
  | 'TRUE_CITRA';

/** Degree / minute / second decomposition */
export interface DMS {
  degrees: number;
  minutes: number;
  seconds: number;
  formatted: string;   // e.g. "15°31'23\""
}

/** Resolved planet position */
export interface PlanetPosition {
  planet: string;
  longitude: number;       // 0–360° ecliptic (normalized)
  latitude: number;        // ecliptic latitude °
  distance: number;        // AU from Earth
  speed: number;           // longitudinal speed °/day
  isRetrograde: boolean;
  sign: string;            // zodiac sign name
  signIndex: number;       // 0=Aries…11=Pisces
  degreeInSign: number;    // 0–<30 decimal
  dms: DMS;                // degree/minute/second within sign
  houseNumber?: number;    // 1–12, assigned at chart level
}

/** House cusp collection */
export interface HouseCusps {
  system: string;          // 'P'=Placidus, 'W'=Whole Sign, etc.
  ascendant: number;       // sidereal or tropical depending on mode
  mc: number;
  vertex: number;
  cusps: number[];         // cusps[0] unused; cusps[1]=H1…cusps[12]=H12
}

export interface EphemerisResult {
  julianDay: number;
  mode: AstrologyMode;
  ayanamsa?: number;
  planets: PlanetPosition[];
  houses: HouseCusps;
}
