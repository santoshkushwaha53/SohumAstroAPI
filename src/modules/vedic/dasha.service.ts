/**
 * Vimshottari Dasha calculation — 120-year cycle over 9 planets.
 *
 * Balance method: linear interpolation of Moon's degree within its nakshatra.
 * fractionElapsed = degreesInNakshatra / NAKSHATRA_SPAN
 * This is the standard method used by Jagannatha Hora, Parashara Light, Kala, etc.
 * It is accurate to within hours (Moon speed variation ≈ ±10% has negligible effect
 * at birth-time precision).
 *
 * Antardasha formula:
 *   Duration of antardasha B within mahadasha A = (B_years / 120) × A_years
 *   Sequence starts from A itself and cycles through all 9 planets.
 *   ∑ all 9 antardashas = A_years (exact, no rounding).
 */
import { getNakshatra } from './nakshatra.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PratyantardashaPeriod {
  planet:        string;
  durationYears: number;
  start:         string;    // ISO date YYYY-MM-DD
  end:           string;
}

export interface AntardashaPeriod {
  planet:           string;
  durationYears:    number;    // exact decimal years for this antardasha
  start:            string;    // ISO date YYYY-MM-DD
  end:              string;
  pratyantardashas?: PratyantardashaPeriod[];
}

export interface DashaPeriod {
  planet:        string;
  durationYears: number;    // decimal years (rounded to 4dp for display)
  start:         string;    // ISO date YYYY-MM-DD
  end:           string;
  antardashas:   AntardashaPeriod[];
}

export interface VimshottariResult {
  moonNakshatra:   string;
  nakshatraLord:   string;
  dashaBalance: {
    planet:          string;
    totalYears:      number;
    elapsedYears:    number;
    remainingYears:  number;
    fractionElapsed: number;
  };
  dashas: DashaPeriod[];
}

// ── Vimshottari order (Ketu → Mercury, standard Indian sequence) ──────────────

export const VIMSHOTTARI_ORDER = [
  { planet: 'Ketu',    years: 7  },
  { planet: 'Venus',   years: 20 },
  { planet: 'Sun',     years: 6  },
  { planet: 'Moon',    years: 10 },
  { planet: 'Mars',    years: 7  },
  { planet: 'Rahu',    years: 18 },
  { planet: 'Jupiter', years: 16 },
  { planet: 'Saturn',  years: 19 },
  { planet: 'Mercury', years: 17 },
] as const;

export const VIMSHOTTARI_TOTAL = 120;
const NAKSHATRA_SPAN = 360 / 27;   // 13.3333…°

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Add fractional years using Julian year (365.25 days). */
function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setTime(d.getTime() + years * 365.25 * 86_400_000);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Antardasha builder ────────────────────────────────────────────────────────

/**
 * Generate all 9 antardashas for a mahadasha.
 *
 * @param mahaLordIndex           Index in VIMSHOTTARI_ORDER of the mahadasha planet
 * @param mahaStartDate           The start date of this mahadasha
 * @param mahaYearsTotal          Full duration of the mahadasha (NOT the remaining portion)
 * @param clipFrom                Only return antardashas whose end > clipFrom (birth date for
 *                                the first partial mahadasha; mahaStart for complete ones)
 * @param includePratyantardasha  Whether to include 3rd-level sub-periods
 */
function buildAntardashas(
  mahaLordIndex: number,
  mahaStartDate: Date,
  mahaYearsTotal: number,
  clipFrom: Date,
  includePratyantardasha: boolean = false
): AntardashaPeriod[] {
  const result: AntardashaPeriod[] = [];
  let cursor = new Date(mahaStartDate);

  for (let i = 0; i < VIMSHOTTARI_ORDER.length; i++) {
    const idx     = (mahaLordIndex + i) % VIMSHOTTARI_ORDER.length;
    const { planet, years } = VIMSHOTTARI_ORDER[idx];
    const antarYears = (years / VIMSHOTTARI_TOTAL) * mahaYearsTotal;

    const antarStart = new Date(cursor);
    const antarEnd   = addYears(cursor, antarYears);
    cursor           = antarEnd;

    // Skip antardashas that ended before the clip date (birth for first maha)
    if (antarEnd <= clipFrom) continue;

    // Clip the start of the straddling antardasha to clipFrom
    const effectiveStart = antarStart < clipFrom ? clipFrom : antarStart;

    const period: AntardashaPeriod = {
      planet,
      durationYears: Math.round(antarYears * 10000) / 10000,
      start: toISODate(effectiveStart),
      end:   toISODate(antarEnd),
    };

    if (includePratyantardasha) {
      period.pratyantardashas = buildPratyantardashas(idx, antarStart, antarYears);
    }

    result.push(period);
  }

  return result;
}

// ── Pratyantardasha builder ───────────────────────────────────────────────────

/**
 * Generate all 9 pratyantardashas within one antardasha period.
 *
 * Duration formula: C_years = (C_planet_years / 120) × antardasha_B_duration_years
 *
 * @param antarLordIndex  Index in VIMSHOTTARI_ORDER of the antardasha lord (B)
 * @param antarStart      Start date of the antardasha
 * @param antarYears      Total duration of the antardasha in years
 */
function buildPratyantardashas(
  antarLordIndex: number,
  antarStart:     Date,
  antarYears:     number
): PratyantardashaPeriod[] {
  const result: PratyantardashaPeriod[] = [];
  let cursor = new Date(antarStart);

  for (let i = 0; i < VIMSHOTTARI_ORDER.length; i++) {
    const idx = (antarLordIndex + i) % VIMSHOTTARI_ORDER.length;
    const { planet, years } = VIMSHOTTARI_ORDER[idx];
    const pratyYears = (years / VIMSHOTTARI_TOTAL) * antarYears;

    const start = new Date(cursor);
    const end   = addYears(cursor, pratyYears);
    cursor      = end;

    result.push({
      planet,
      durationYears: Math.round(pratyYears * 10000) / 10000,
      start: toISODate(start),
      end:   toISODate(end),
    });
  }

  return result;
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function calcVimshottari(
  siderealMoonLongitude: number,
  birthDate: Date,
  yearsAhead: number = 100,
  includePratyantardasha: boolean = false
): VimshottariResult {
  const nk = getNakshatra(siderealMoonLongitude);
  const lordName  = nk.lord;
  const lordIndex = VIMSHOTTARI_ORDER.findIndex((d) => d.planet === lordName);
  if (lordIndex === -1) throw new Error(`Nakshatra lord "${lordName}" not in Vimshottari sequence`);

  // ── Balance calculation ────────────────────────────────────────────────────
  // Moon is degreesInNakshatra into a 13.333° span → fraction elapsed in this dasha
  const fractionElapsed     = nk.degreesInNakshatra / NAKSHATRA_SPAN;
  const currentDashaYears   = VIMSHOTTARI_ORDER[lordIndex].years;
  const yearsElapsed        = fractionElapsed * currentDashaYears;
  const remainingYears      = currentDashaYears - yearsElapsed;

  // Effective start of the current (first) mahadasha — may be before birth
  const mahaEffectiveStart  = addYears(birthDate, -yearsElapsed);

  // ── Build mahadasha list ──────────────────────────────────────────────────
  const dashas: DashaPeriod[] = [];
  let cursor       = new Date(birthDate);
  let totalGenerated = 0;

  for (let i = 0; totalGenerated < yearsAhead; i++) {
    const idx             = (lordIndex + i) % VIMSHOTTARI_ORDER.length;
    const { planet, years } = VIMSHOTTARI_ORDER[idx];

    const periodYears = i === 0 ? remainingYears : years;
    if (periodYears <= 0) { cursor = addYears(cursor, years); continue; }

    const start = new Date(cursor);
    const end   = addYears(cursor, periodYears);

    // For antardasha generation, use the full mahadasha duration (not remaining)
    // and the effective start of the mahadasha so antardasha dates are exact
    const effectiveMahaStart = i === 0 ? mahaEffectiveStart : start;
    const antardashas = buildAntardashas(idx, effectiveMahaStart, years, start, includePratyantardasha);

    dashas.push({
      planet,
      durationYears:  Math.round(periodYears * 10000) / 10000,
      start:          toISODate(start),
      end:            toISODate(end),
      antardashas,
    });

    cursor         = end;
    totalGenerated += periodYears;
  }

  return {
    moonNakshatra:  nk.name,
    nakshatraLord:  lordName,
    dashaBalance: {
      planet:          lordName,
      totalYears:      currentDashaYears,
      elapsedYears:    Math.round(yearsElapsed   * 10000) / 10000,
      remainingYears:  Math.round(remainingYears * 10000) / 10000,
      fractionElapsed: Math.round(fractionElapsed * 10000) / 10000,
    },
    dashas,
  };
}
