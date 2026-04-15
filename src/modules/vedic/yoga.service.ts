/**
 * Vedic Yoga and Dosha detection.
 *
 * All checks are rule-based and deterministic. This module only identifies
 * presence/absence and the qualifying factors — NO interpretation is added.
 *
 * Implemented:
 *   Doshas:
 *     1. Manglik Dosha — Mars in houses 1, 2, 4, 7, 8, 12
 *     2. Kaal Sarpa Dosha — all 7 visible planets between Rahu and Ketu arc
 *
 *   Panchamahapurusha Yogas (exaltation or own-sign in kendra house 1/4/7/10):
 *     3. Hamsa    — Jupiter in Cancer/Sagittarius/Pisces in kendra
 *     4. Malavya  — Venus in Taurus/Libra/Pisces in kendra
 *     5. Ruchaka  — Mars in Aries/Scorpio/Capricorn in kendra
 *     6. Bhadra   — Mercury in Gemini/Virgo in kendra
 *     7. Shasha   — Saturn in Capricorn/Aquarius/Libra in kendra
 *
 *   Other major yogas:
 *     8. Gaja Kesari Yoga  — Jupiter in kendra (1/4/7/10) from Moon
 *     9. Budhaditya Yoga   — Sun and Mercury conjunct (within 15°) in same sign
 *
 * References: BPHS (Parashara), Phaladeepika.
 */

import type { PlanetPosition } from '../astronomy/types';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface YogaResult {
  name:        string;
  present:     boolean;
  planets:     string[];      // qualifying planet names
  houseOrSign: string;        // qualifying house(s) or sign(s)
  notes:       string;
}

export interface YogaDoshaReport {
  manglikDosha:         YogaResult;
  kaalSarpaDosha:       YogaResult;
  panchamahapurusha:    YogaResult[];   // up to 5 entries (Hamsa/Malavya/Ruchaka/Bhadra/Shasha)
  gajaKesariYoga:       YogaResult;
  budhadityaYoga:       YogaResult;
}

// ── Lookup tables ──────────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

/** Signs where each planet is exalted or in its own sign (for Panchamahapurusha) */
const PANCHA_SIGNS: Record<string, number[]> = {
  Jupiter: [3, 8, 11],       // Cancer(exalt), Sagittarius(own), Pisces(own)
  Venus:   [1, 6, 11],       // Taurus(own), Libra(own), Pisces(exalt)
  Mars:    [0, 7, 9],        // Aries(own), Scorpio(own), Capricorn(exalt)
  Mercury: [2, 5],           // Gemini(own), Virgo(own+exalt)
  Saturn:  [9, 10, 6],       // Capricorn(own), Aquarius(own), Libra(exalt)
};

const PANCHA_NAMES: Record<string, string> = {
  Jupiter: 'Hamsa',
  Venus:   'Malavya',
  Mars:    'Ruchaka',
  Mercury: 'Bhadra',
  Saturn:  'Shasha',
};

// Kendra houses from ascendant (1-indexed): 1, 4, 7, 10
const KENDRA_HOUSES = new Set([1, 4, 7, 10]);

// Manglik dosha houses (1-indexed): 1, 2, 4, 7, 8, 12
const MANGLIK_HOUSES = new Set([1, 2, 4, 7, 8, 12]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalize360(n: number): number {
  return ((n % 360) + 360) % 360;
}

/** Signed shortest angular difference between two longitudes (−180 to +180). */
function angleDiff(a: number, b: number): number {
  let d = normalize360(a - b);
  if (d > 180) d -= 360;
  return d;
}

/** Get planet by name from list. Returns undefined if not found. */
function getPlanet(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
  return planets.find((p) => p.planet === name);
}

/** House of a planet (1–12). Returns 0 if houseNumber is not set. */
function houseOf(p: PlanetPosition): number {
  return p.houseNumber ?? 0;
}

// ── Dosha detectors ───────────────────────────────────────────────────────────

function detectManglikDosha(planets: PlanetPosition[]): YogaResult {
  const mars = getPlanet(planets, 'Mars');
  if (!mars || houseOf(mars) === 0) {
    return { name: 'Manglik Dosha', present: false, planets: [], houseOrSign: '', notes: 'House positions required' };
  }

  const h = houseOf(mars);
  const present = MANGLIK_HOUSES.has(h);
  return {
    name:        'Manglik Dosha',
    present,
    planets:     ['Mars'],
    houseOrSign: `House ${h}`,
    notes:       present
      ? `Mars in house ${h} (qualifying houses: 1, 2, 4, 7, 8, 12)`
      : `Mars in house ${h} — no dosha`,
  };
}

function detectKaalSarpaDosha(planets: PlanetPosition[]): YogaResult {
  const rahu = getPlanet(planets, 'Rahu');
  const ketu = getPlanet(planets, 'Ketu');

  if (!rahu || !ketu) {
    return { name: 'Kaal Sarpa Dosha', present: false, planets: [], houseOrSign: '', notes: 'Rahu/Ketu positions required' };
  }

  const rahuLon = rahu.longitude;
  const ketuLon = ketu.longitude;

  // The "arc from Rahu to Ketu" going forward (Rahu → clockwise → Ketu)
  // All visible planets must lie within this arc (neither outside it)
  const visiblePlanets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  const hemispherePlanets: string[] = [];
  const outsidePlanets: string[] = [];

  for (const name of visiblePlanets) {
    const p = getPlanet(planets, name);
    if (!p) continue;

    // Measure angle from Rahu to planet going forward
    const fromRahu = normalize360(p.longitude - rahuLon);
    // Measure arc from Rahu to Ketu going forward
    const rahuToKetu = normalize360(ketuLon - rahuLon);

    if (fromRahu < rahuToKetu) {
      hemispherePlanets.push(name);
    } else {
      outsidePlanets.push(name);
    }
  }

  // Kaal Sarpa: ALL planets in one hemisphere (either all between Rahu→Ketu or all Ketu→Rahu)
  const present = outsidePlanets.length === 0 || hemispherePlanets.length === 0;

  return {
    name:        'Kaal Sarpa Dosha',
    present,
    planets:     present ? visiblePlanets.filter((n) => getPlanet(planets, n)) : [],
    houseOrSign: `Rahu: ${ZODIAC_SIGNS[rahu.signIndex] ?? '?'}, Ketu: ${ZODIAC_SIGNS[ketu.signIndex] ?? '?'}`,
    notes:       present
      ? 'All visible planets confined between Rahu-Ketu axis'
      : `Planets outside Rahu-Ketu arc: ${outsidePlanets.join(', ')}`,
  };
}

// ── Panchamahapurusha yoga detectors ─────────────────────────────────────────

function detectPanchamahapurusha(planets: PlanetPosition[]): YogaResult[] {
  const results: YogaResult[] = [];

  for (const [planetName, signs] of Object.entries(PANCHA_SIGNS)) {
    const yogaName = PANCHA_NAMES[planetName] ?? planetName;
    const p = getPlanet(planets, planetName);

    if (!p || houseOf(p) === 0) {
      results.push({ name: yogaName, present: false, planets: [planetName], houseOrSign: '', notes: 'House positions required' });
      continue;
    }

    const inQualifyingSign  = signs.includes(p.signIndex);
    const inKendra          = KENDRA_HOUSES.has(houseOf(p));
    const present           = inQualifyingSign && inKendra;

    const qualSigns = signs.map((s) => ZODIAC_SIGNS[s] ?? '?').join('/');
    results.push({
      name:        yogaName,
      present,
      planets:     [planetName],
      houseOrSign: `${ZODIAC_SIGNS[p.signIndex] ?? '?'}, House ${houseOf(p)}`,
      notes:       present
        ? `${planetName} in ${ZODIAC_SIGNS[p.signIndex] ?? '?'} (house ${houseOf(p)}) — kendra + own/exalt sign`
        : `${planetName} in ${ZODIAC_SIGNS[p.signIndex] ?? '?'} (house ${houseOf(p)}) — requires kendra (1/4/7/10) AND sign in {${qualSigns}}`,
    });
  }

  return results;
}

// ── Other major yogas ─────────────────────────────────────────────────────────

function detectGajaKesariYoga(planets: PlanetPosition[]): YogaResult {
  const moon    = getPlanet(planets, 'Moon');
  const jupiter = getPlanet(planets, 'Jupiter');

  if (!moon || !jupiter) {
    return { name: 'Gaja Kesari Yoga', present: false, planets: [], houseOrSign: '', notes: 'Moon and Jupiter required' };
  }

  // Gaja Kesari: Jupiter in kendra (1,4,7,10) from Moon
  const signDiff = normalize360(jupiter.longitude - moon.longitude);
  const relativeHouse = Math.floor(signDiff / 30) + 1;  // 1–12
  const present = KENDRA_HOUSES.has(relativeHouse);

  return {
    name:        'Gaja Kesari Yoga',
    present,
    planets:     ['Moon', 'Jupiter'],
    houseOrSign: `Jupiter in house ${relativeHouse} from Moon`,
    notes:       present
      ? `Jupiter is ${relativeHouse} signs ahead of Moon (kendra position)`
      : `Jupiter is ${relativeHouse} signs ahead of Moon (not in kendra 1/4/7/10)`,
  };
}

function detectBudhadityaYoga(planets: PlanetPosition[]): YogaResult {
  const sun     = getPlanet(planets, 'Sun');
  const mercury = getPlanet(planets, 'Mercury');

  if (!sun || !mercury) {
    return { name: 'Budhaditya Yoga', present: false, planets: [], houseOrSign: '', notes: 'Sun and Mercury required' };
  }

  const orb     = Math.abs(angleDiff(sun.longitude, mercury.longitude));
  const sameSgn = sun.signIndex === mercury.signIndex;
  const present = sameSgn && orb <= 15;

  return {
    name:        'Budhaditya Yoga',
    present,
    planets:     ['Sun', 'Mercury'],
    houseOrSign: `${ZODIAC_SIGNS[sun.signIndex] ?? '?'}, House ${houseOf(sun)}`,
    notes:       present
      ? `Sun and Mercury conjunct in ${ZODIAC_SIGNS[sun.signIndex] ?? '?'} within ${orb.toFixed(2)}°`
      : sameSgn
        ? `Sun and Mercury in same sign but orb ${orb.toFixed(2)}° > 15°`
        : `Sun in ${ZODIAC_SIGNS[sun.signIndex] ?? '?'}, Mercury in ${ZODIAC_SIGNS[mercury.signIndex] ?? '?'} — different signs`,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute all Yoga and Dosha checks for a given chart.
 *
 * @param planets  Array of PlanetPosition with houseNumber set (from calcChart)
 */
export function calcYogasAndDoshas(planets: PlanetPosition[]): YogaDoshaReport {
  return {
    manglikDosha:      detectManglikDosha(planets),
    kaalSarpaDosha:    detectKaalSarpaDosha(planets),
    panchamahapurusha: detectPanchamahapurusha(planets),
    gajaKesariYoga:    detectGajaKesariYoga(planets),
    budhadityaYoga:    detectBudhadityaYoga(planets),
  };
}
