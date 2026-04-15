/**
 * EphemerisService — wrapper around swisseph v0.5.x (Moshier mode, no files needed).
 *
 * Sidereal strategy: calculate tropical with SEFLG_MOSEPH, then subtract ayanamsa.
 * Reason: SEFLG_SIDEREAL combined with SEFLG_MOSEPH triggers a SWIEPH file lookup
 * in v0.5.x (seas_*.se1), which fails without data files. Manual subtraction is
 * mathematically equivalent.
 *
 * Ketu: South Node = normalize360(Rahu + 180°). Derived, not a separate swisseph call.
 *
 * Whole Sign sidereal: swisseph 'W' returns cusps at tropical sign boundaries.
 * After ayanamsa subtraction those cusps fall inside sidereal signs, not at boundaries.
 * Fix: compute sidereal ascendant → determine sidereal House-1 sign → cusps at N×30°.
 */
import * as swe from 'swisseph';
import { config } from '../../config';
import { logger } from '../../config/logger';
import type { GeoLocation } from '../shared/types';
import type {
  AstrologyMode,
  AyanamsaName,
  DMS,
  EphemerisResult,
  HouseCusps,
  PlanetPosition,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

/**
 * Planets computable with Moshier (no data files).
 * Key is the canonical name used in all API responses.
 * Ketu is omitted here — it is derived after Rahu is computed.
 */
const PLANET_IDS: Record<string, number> = {
  Sun:     swe.SE_SUN,
  Moon:    swe.SE_MOON,
  Mercury: swe.SE_MERCURY,
  Venus:   swe.SE_VENUS,
  Mars:    swe.SE_MARS,
  Jupiter: swe.SE_JUPITER,
  Saturn:  swe.SE_SATURN,
  Uranus:  swe.SE_URANUS,
  Neptune: swe.SE_NEPTUNE,
  Pluto:   swe.SE_PLUTO,
  Rahu:    swe.SE_MEAN_NODE,  // Mean North Node
};

/** Planets requiring SWIEPH asteroid files (set EPHE_PATH env var). */
const EXTENDED_PLANET_IDS: Record<string, number> = {
  Chiron: swe.SE_CHIRON,
  Pholus: swe.SE_PHOLUS,
  Ceres:  swe.SE_CERES,
};

const AYANAMSA_MAP: Record<AyanamsaName, number> = {
  LAHIRI:        swe.SE_SIDM_LAHIRI,
  RAMAN:         swe.SE_SIDM_RAMAN,
  KRISHNAMURTI:  swe.SE_SIDM_KRISHNAMURTI,
  FAGAN_BRADLEY: swe.SE_SIDM_FAGAN_BRADLEY,
  TRUE_CITRA:    swe.SE_SIDM_TRUE_CITRA,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function normalize360(n: number): number {
  return ((n % 360) + 360) % 360;
}

/** Decompose a decimal longitude into degrees/minutes/seconds within its sign. */
export function toDMS(degreeInSign: number): DMS {
  const totalSec = Math.round(degreeInSign * 3600);
  const degrees  = Math.floor(totalSec / 3600);
  const minutes  = Math.floor((totalSec % 3600) / 60);
  const seconds  = totalSec % 60;
  return {
    degrees,
    minutes,
    seconds,
    formatted: `${degrees}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(2, '0')}"`,
  };
}

function makePlanetPosition(
  name: string,
  lon: number,
  latitude: number,
  distance: number,
  speed: number,
  houseNumber?: number
): PlanetPosition {
  const norm        = normalize360(lon);
  const signIndex   = Math.floor(norm / 30);
  const degreeInSign = norm % 30;
  return {
    planet:      name,
    longitude:   norm,
    latitude,
    distance,
    speed,
    isRetrograde: speed < 0,
    sign:         ZODIAC_SIGNS[signIndex] ?? 'Unknown',
    signIndex,
    degreeInSign,
    dms:          toDMS(degreeInSign),
    houseNumber,
  };
}

function calcUtAsync(jd: number, planetId: number, flags: number): Promise<{
  longitude: number; latitude: number; distance: number;
  longitudeSpeed: number; latitudeSpeed: number; distanceSpeed: number;
}> {
  return new Promise((resolve, reject) => {
    swe.swe_calc_ut(jd, planetId, flags, (result) => {
      if ('error' in result)
        return reject(new Error(`swe_calc_ut [planet ${planetId}]: ${(result as { error: string }).error}`));
      if (!('longitude' in result))
        return reject(new Error(`swe_calc_ut [planet ${planetId}]: unexpected result format`));
      resolve(result as {
        longitude: number; latitude: number; distance: number;
        longitudeSpeed: number; latitudeSpeed: number; distanceSpeed: number;
      });
    });
  });
}

function housesAsync(jd: number, lat: number, lon: number, hsys: string): Promise<{
  house: number[]; ascendant: number; mc: number; armc: number; vertex: number;
}> {
  return new Promise((resolve, reject) => {
    swe.swe_houses(jd, lat, lon, hsys, (result) => {
      if ('error' in result)
        return reject(new Error(`swe_houses: ${(result as { error: string }).error}`));
      resolve(result as {
        house: number[]; ascendant: number; mc: number; armc: number; vertex: number;
      });
    });
  });
}

// ── Service ───────────────────────────────────────────────────────────────────

class EphemerisService {
  private readonly flags: number = swe.SEFLG_MOSEPH | swe.SEFLG_SPEED;

  constructor() {
    if (config.EPHE_PATH) {
      swe.swe_set_ephe_path(config.EPHE_PATH);
      logger.info({ ephePath: config.EPHE_PATH }, 'Swiss Ephemeris: file-based mode');
    } else {
      logger.info('Swiss Ephemeris: Moshier built-in mode (no data files required)');
    }
  }

  // ── Ayanamsa ────────────────────────────────────────────────────────────────

  getAyanamsa(jd: number, ayanamsa: AyanamsaName = 'LAHIRI'): number {
    const sidMode = AYANAMSA_MAP[ayanamsa];
    if (sidMode === undefined) {
      logger.warn({ ayanamsa }, 'Unknown ayanamsa; defaulting to LAHIRI');
      swe.swe_set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
    } else {
      swe.swe_set_sid_mode(sidMode, 0, 0);
    }
    return swe.swe_get_ayanamsa_ut(jd);
  }

  // ── Single planet ───────────────────────────────────────────────────────────

  async calcPlanet(
    jd: number,
    planetId: number,
    nameOverride: string,
    mode: AstrologyMode,
    ayanamsa: AyanamsaName = 'LAHIRI'
  ): Promise<PlanetPosition> {
    const raw = await calcUtAsync(jd, planetId, this.flags);

    let lon = normalize360(raw.longitude);
    if (mode === 'sidereal') {
      lon = normalize360(lon - this.getAyanamsa(jd, ayanamsa));
    }

    return makePlanetPosition(nameOverride, lon, raw.latitude, raw.distance, raw.longitudeSpeed);
  }

  // ── All planets (+ Ketu) ─────────────────────────────────────────────────────

  async calcPlanets(
    jd: number,
    mode: AstrologyMode,
    ayanamsa: AyanamsaName = 'LAHIRI',
    requestedNames?: string[]
  ): Promise<PlanetPosition[]> {
    const names = requestedNames ?? [...Object.keys(PLANET_IDS), 'Ketu'];

    // Separate Ketu from the real planets
    const includeKetu    = names.includes('Ketu');
    const planetNames    = names.filter((n) => n !== 'Ketu');

    // Build list of (name, id) pairs, including extended planets if EPHE_PATH set
    const allIds = { ...PLANET_IDS, ...(config.EPHE_PATH ? EXTENDED_PLANET_IDS : {}) };
    const pairs: Array<{ name: string; id: number }> = planetNames.map((name) => {
      const id = allIds[name];
      if (id === undefined) throw new Error(`Unknown planet: "${name}"`);
      return { name, id };
    });

    // Compute all real planets in parallel
    const positions = await Promise.all(
      pairs.map(({ name, id }) => this.calcPlanet(jd, id, name, mode, ayanamsa))
    );

    // Derive Ketu from Rahu (always present when Ketu requested)
    if (includeKetu) {
      const rahu = positions.find((p) => p.planet === 'Rahu');
      if (!rahu) throw new Error('Rahu must be computed to derive Ketu');
      const ketuLon = normalize360(rahu.longitude + 180);
      positions.push(
        makePlanetPosition('Ketu', ketuLon, -rahu.latitude, rahu.distance, rahu.speed)
      );
    }

    return positions;
  }

  // ── Houses ──────────────────────────────────────────────────────────────────

  /**
   * Whole Sign sidereal: swisseph 'W' puts cusp[1] at the tropical sign boundary
   * of the tropical ascendant's sign. After ayanamsa subtraction that cusp sits
   * at an arbitrary degree inside a sidereal sign — not at the sign boundary.
   *
   * Correct behaviour: sidereal ascendant → find its sign → cusps at N×30°.
   */
  async calcHouses(
    jd: number,
    geo: GeoLocation,
    houseSystem: string = 'P',
    mode: AstrologyMode = 'tropical',
    ayanamsa: AyanamsaName = 'LAHIRI'
  ): Promise<HouseCusps> {
    const raw = await housesAsync(jd, geo.latitude, geo.longitude, houseSystem);

    // swisseph v0.5.x returns house[] 0-indexed → re-index to 1-based
    const tropicalCusps: number[] = [0, ...raw.house];  // [0, H1, H2, …, H12]

    let ascendant = normalize360(raw.ascendant);
    let mc        = normalize360(raw.mc);
    let vertex    = normalize360(raw.vertex);
    let cusps     = [...tropicalCusps];

    if (mode === 'sidereal') {
      const ay = this.getAyanamsa(jd, ayanamsa);

      // Sidereal ascendant (always apply ayanamsa regardless of house system)
      ascendant = normalize360(ascendant - ay);
      mc        = normalize360(mc - ay);
      vertex    = normalize360(vertex - ay);

      if (houseSystem === 'W') {
        // True Whole Sign: cusps sit at exact sidereal sign boundaries
        const h1SignIndex = Math.floor(ascendant / 30);
        for (let i = 1; i <= 12; i++) {
          cusps[i] = ((h1SignIndex + i - 1) % 12) * 30;
        }
      } else {
        // All other systems: shift tropical cusps by ayanamsa
        for (let i = 1; i <= 12; i++) {
          cusps[i] = normalize360((cusps[i] ?? 0) - ay);
        }
      }
    } else if (houseSystem === 'W') {
      // Tropical Whole Sign: swisseph puts cusp[1] at ascendant degree, not sign boundary.
      // Fix: cusps at tropical sign boundaries.
      const h1SignIndex = Math.floor(ascendant / 30);
      for (let i = 1; i <= 12; i++) {
        cusps[i] = ((h1SignIndex + i - 1) % 12) * 30;
      }
    }

    return { system: houseSystem, ascendant, mc, vertex, cusps };
  }

  // ── House assignment for planets ─────────────────────────────────────────────

  assignHouses(planets: PlanetPosition[], houses: HouseCusps): PlanetPosition[] {
    return planets.map((p) => {
      let houseNumber = 1;
      for (let h = 12; h >= 1; h--) {
        const cuspH    = houses.cusps[h]  ?? 0;
        const cuspNext = houses.cusps[h < 12 ? h + 1 : 1] ?? 0;

        let inHouse: boolean;
        if (cuspH < cuspNext) {
          inHouse = p.longitude >= cuspH && p.longitude < cuspNext;
        } else {
          // Cusp wraps around 360°
          inHouse = p.longitude >= cuspH || p.longitude < cuspNext;
        }
        if (inHouse) { houseNumber = h; break; }
      }
      return { ...p, houseNumber };
    });
  }

  // ── Full chart ───────────────────────────────────────────────────────────────

  async calcChart(
    jd: number,
    geo: GeoLocation,
    mode: AstrologyMode,
    ayanamsa: AyanamsaName = 'LAHIRI',
    houseSystem: string = 'P',
    planetNames?: string[]
  ): Promise<EphemerisResult> {
    const [planetsRaw, houses] = await Promise.all([
      this.calcPlanets(jd, mode, ayanamsa, planetNames),
      this.calcHouses(jd, geo, houseSystem, mode, ayanamsa),
    ]);

    const planets       = this.assignHouses(planetsRaw, houses);
    const ayanamsaValue = mode === 'sidereal' ? this.getAyanamsa(jd, ayanamsa) : undefined;
    return { julianDay: jd, mode, ayanamsa: ayanamsaValue, planets, houses };
  }

  close(): void { swe.swe_close(); }
}

export const ephemerisService = new EphemerisService();
