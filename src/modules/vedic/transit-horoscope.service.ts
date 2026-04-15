/**
 * Vedic Transit Horoscope — raw planetary data engine.
 *
 * Returns structured transit data for daily / weekly / monthly / yearly periods.
 * NO interpretation text. AI layer sits on top of this.
 *
 * Each entry provides:
 *  - Date + Moon nakshatra / tithi for that day (for nakshatra-based daily guidance)
 *  - All transiting planets with sign, natal-house, speed, retrograde flag
 *  - Key transit events: sign ingresses, retrograde stations, tight natal aspects (≤1.5°)
 *  - Panchang summary (choghadiya, auspicious slots) for daily/weekly
 *
 * Periods:
 *   daily    — 1 day, full detail (all planets, panchang)
 *   tomorrow — same as daily but for tomorrow
 *   weekly   — 7 days, daily rows with Moon + key events only (slow planet data once)
 *   monthly  — 30 days, Moon + slow planet sign/retro per day, events list
 *   yearly   — 12 months, summary rows + major transit events (no Moon per day)
 */

import { ephemerisService, normalize360 } from '../astronomy/ephemeris.service';
import { getNakshatra } from './nakshatra.service';
import { calcTithi } from '../panchang/panchang.service';
import { calcSunTimes } from '../panchang/sunrise';
import type { AyanamsaName, PlanetPosition } from '../astronomy/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HoroscopePeriod = 'daily' | 'tomorrow' | 'weekly' | 'monthly' | 'yearly';

export interface TransitPlanetSnapshot {
  planet:         string;
  longitude:      number;
  sign:           string;
  signIndex:      number;
  degreeInSign:   number;
  dmsFormatted:   string;
  isRetrograde:   boolean;
  speed:          number;
  natalHouse:     number | null;   // house in natal chart this planet is transiting
}

export interface TransitEvent {
  date:        string;
  eventType:   'sign_ingress' | 'retrograde_station' | 'direct_station' | 'tight_natal_aspect';
  planet:      string;
  description: string;  // e.g. "Saturn enters Aries" — factual only
  detail:      Record<string, unknown>;
}

export interface DailyHoroscopeRow {
  date:            string;         // YYYY-MM-DD
  weekday:         string;
  moonNakshatra:   { name: string; index: number; pada: number; lord: string };
  moonSign:        string;
  tithi:           { name: string; paksha: string; pakshaIndex: number };
  sunrise:         string | null;  // local HH:MM:SS
  sunset:          string | null;
  planets:         TransitPlanetSnapshot[];
  events:          TransitEvent[];
  auspiciousSlots: AuspiciousSlot[];
}

export interface AuspiciousSlot {
  name:       string;   // e.g. "Amrit Choghadiya", "Abhijit Muhurat"
  startLocal: string;
  endLocal:   string;
  quality:    'excellent' | 'good' | 'neutral' | 'inauspicious';
}

export interface MonthlyRow {
  date:          string;
  weekday:       string;
  moonNakshatra: string;
  moonSign:      string;
  tithi:         string;
  moonLongitude: number;
  events:        TransitEvent[];
}

export interface YearlyMonthSummary {
  month:        string;   // YYYY-MM
  slowPlanets:  Array<{ planet: string; sign: string; isRetrograde: boolean }>;
  moonIngresses: Array<{ date: string; nakshatra: string; sign: string }>;
  events:        TransitEvent[];
}

export interface HoroscopeResult {
  period:        HoroscopePeriod;
  generatedFor:  string;    // date or date range (start)
  natalSummary:  { ascendantSign: string; moonSign: string; moonNakshatra: string };
  daily?:        DailyHoroscopeRow;
  weekly?:       DailyHoroscopeRow[];
  monthly?:      MonthlyRow[];
  yearly?:       YearlyMonthSummary[];
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];
const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const CHOGHADIYA_DAY: Record<number, string[]> = {
  0:['U','S','L','A','K','S','R','C'], 1:['A','K','S','R','C','U','S','L'],
  2:['R','C','U','S','L','A','K','S'], 3:['S','L','A','K','S','R','C','U'],
  4:['K','S','R','C','U','S','L','A'], 5:['C','U','S','L','A','K','S','R'],
  6:['L','A','K','S','R','C','U','S'],
};
const CHOGHADIYA_QUALITY: Record<string, { name: string; quality: 'excellent'|'good'|'neutral'|'inauspicious' }> = {
  A: { name: 'Amrit',  quality: 'excellent' },
  S: { name: 'Shubh',  quality: 'good'      },
  L: { name: 'Labh',   quality: 'good'      },
  C: { name: 'Char',   quality: 'neutral'   },
  U: { name: 'Udveg',  quality: 'inauspicious' },
  K: { name: 'Kaal',   quality: 'inauspicious' },
  R: { name: 'Rog',    quality: 'inauspicious' },
};

const RAHU_KAAL_SEGMENT: Record<number, number> = { 0:8, 1:2, 2:7, 3:5, 4:6, 5:4, 6:3 };

// Slow planets (don't change sign daily) - included in monthly summary
const SLOW_PLANETS = ['Sun','Mars','Jupiter','Saturn','Rahu','Ketu','Neptune','Uranus','Pluto'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseTzOffset(tz: string): number {
  if (!tz || tz === 'UTC' || tz === 'Z' || tz === '+00:00') return 0;
  const m = tz.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid timezone: "${tz}"`);
  return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) + parseInt(m[3]) / 60);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fracHoursToStr(h: number | null): string | null {
  if (h === null) return null;
  const t  = Math.round(((h % 24) + 24) % 24 * 3600);
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function weekdayFromJD(jd: number): number {
  return Math.floor(jd + 1.5) % 7;
}

/** Signed shortest angular difference (−180 to +180). */
function angleDiff(a: number, b: number): number {
  let d = normalize360(a - b);
  if (d > 180) d -= 360;
  return d;
}

/** Planet-to-Whole-Sign house from natal ascendant sign. */
function whichNatalHouse(transitLon: number, ascSignIdx: number): number {
  const transitSignIdx = Math.floor(normalize360(transitLon) / 30);
  return ((transitSignIdx - ascSignIdx + 12) % 12) + 1;
}

// ── Per-day calculator ────────────────────────────────────────────────────────

async function calcDaySnapshot(
  jdMidnight: number,
  lat: number,
  lon: number,
  tzOffset: number,
  ayanamsa: AyanamsaName,
  natalAscSignIdx: number,
  natalPlanets: PlanetPosition[],
  fullDetail: boolean,
  prevDayPlanets?: TransitPlanetSnapshot[]
): Promise<DailyHoroscopeRow> {
  const swe = await import('swisseph');

  const sunTimes     = calcSunTimes(jdMidnight, lat, lon);
  const srUTC        = sunTimes.sunriseUTC ?? 6;
  const ssUTC        = sunTimes.sunsetUTC  ?? 18;

  // Use sunrise JD for Moon nakshatra/tithi (traditional standard)
  const jdSunrise    = jdMidnight + srUTC / 24;

  // Fetch Sun, Moon at sunrise (fast) + all slow planets at noon
  const jdNoon       = jdMidnight + (12 - tzOffset) / 24;

  const [sunAtSr, moonAtSr] = await Promise.all([
    ephemerisService.calcPlanet(jdSunrise, swe.SE_SUN,  'Sun',  'sidereal', ayanamsa),
    ephemerisService.calcPlanet(jdSunrise, swe.SE_MOON, 'Moon', 'sidereal', ayanamsa),
  ]);

  const PLANET_IDS: Array<{ id: number; name: string }> = [
    { id: swe.SE_SUN,     name: 'Sun'     },
    { id: swe.SE_MOON,    name: 'Moon'    },
    { id: swe.SE_MERCURY, name: 'Mercury' },
    { id: swe.SE_VENUS,   name: 'Venus'   },
    { id: swe.SE_MARS,    name: 'Mars'    },
    { id: swe.SE_JUPITER, name: 'Jupiter' },
    { id: swe.SE_SATURN,  name: 'Saturn'  },
    { id: swe.SE_URANUS,  name: 'Uranus'  },
    { id: swe.SE_NEPTUNE, name: 'Neptune' },
    { id: swe.SE_PLUTO,   name: 'Pluto'   },
  ];

  const allPlanets = await Promise.all(
    PLANET_IDS.map(({ id, name }) =>
      ephemerisService.calcPlanet(jdNoon, id, name, 'sidereal', ayanamsa)
    )
  );

  // Add Rahu/Ketu
  const rahuRaw = await ephemerisService.calcPlanet(jdNoon, swe.SE_MEAN_NODE, 'Rahu', 'sidereal', ayanamsa);
  const ketuLon = normalize360(rahuRaw.longitude + 180);
  const ketuPos: PlanetPosition = {
    ...rahuRaw,
    planet: 'Ketu', longitude: ketuLon,
    signIndex: Math.floor(ketuLon / 30),
    sign: ZODIAC_SIGNS[Math.floor(ketuLon / 30)] ?? 'Unknown',
    degreeInSign: ketuLon % 30,
    dms: { degrees: Math.floor(ketuLon % 30), minutes: Math.floor((ketuLon % 1) * 60), seconds: 0, formatted: `${Math.floor(ketuLon % 30)}°` },
  };
  allPlanets.push(rahuRaw, ketuPos);

  const planets: TransitPlanetSnapshot[] = allPlanets.map((p) => ({
    planet:       p.planet,
    longitude:    Number(p.longitude.toFixed(6)),
    sign:         p.sign,
    signIndex:    p.signIndex,
    degreeInSign: Number(p.degreeInSign.toFixed(4)),
    dmsFormatted: p.dms.formatted,
    isRetrograde: p.isRetrograde,
    speed:        Number(p.speed.toFixed(6)),
    natalHouse:   whichNatalHouse(p.longitude, natalAscSignIdx),
  }));

  // ── Detect events for this day ────────────────────────────────────────────
  const events: TransitEvent[] = [];
  const dateStr = toYMD(new Date((jdMidnight - 2440587.5) * 86400000));

  // Sign ingresses + retrograde stations (compare with previous day)
  if (prevDayPlanets) {
    for (const cur of planets) {
      const prev = prevDayPlanets.find((p) => p.planet === cur.planet);
      if (!prev) continue;

      if (prev.signIndex !== cur.signIndex) {
        events.push({
          date: dateStr,
          eventType: 'sign_ingress',
          planet: cur.planet,
          description: `${cur.planet} enters ${cur.sign}`,
          detail: { fromSign: ZODIAC_SIGNS[prev.signIndex] ?? '?', toSign: cur.sign, longitude: cur.longitude },
        });
      }
      if (!prev.isRetrograde && cur.isRetrograde) {
        events.push({
          date: dateStr,
          eventType: 'retrograde_station',
          planet: cur.planet,
          description: `${cur.planet} stations retrograde in ${cur.sign}`,
          detail: { sign: cur.sign, degree: cur.degreeInSign },
        });
      }
      if (prev.isRetrograde && !cur.isRetrograde) {
        events.push({
          date: dateStr,
          eventType: 'direct_station',
          planet: cur.planet,
          description: `${cur.planet} stations direct in ${cur.sign}`,
          detail: { sign: cur.sign, degree: cur.degreeInSign },
        });
      }
    }
  }

  // Tight aspects to natal planets (orb ≤ 1.5°)
  const MAJOR_ASPECTS = [0, 60, 90, 120, 180];
  const ASPECT_NAMES: Record<number, string> = { 0:'Conjunction', 60:'Sextile', 90:'Square', 120:'Trine', 180:'Opposition' };

  for (const tp of planets) {
    for (const np of natalPlanets) {
      for (const angle of MAJOR_ASPECTS) {
        const orb = Math.abs(Math.abs(angleDiff(tp.longitude, np.longitude)) - angle);
        if (orb <= 1.5) {
          events.push({
            date: dateStr,
            eventType: 'tight_natal_aspect',
            planet: tp.planet,
            description: `T:${tp.planet} ${ASPECT_NAMES[angle]} N:${np.planet} (${orb.toFixed(2)}°)`,
            detail: { transitPlanet: tp.planet, natalPlanet: np.planet, aspect: ASPECT_NAMES[angle], orb: Number(orb.toFixed(2)), angle },
          });
          break; // one aspect per transit-natal pair
        }
      }
    }
  }

  // ── Auspicious slots ──────────────────────────────────────────────────────
  const auspiciousSlots: AuspiciousSlot[] = [];
  if (fullDetail) {
    const weekday    = weekdayFromJD(jdMidnight);
    const dayLen     = ssUTC - srUTC;
    const segLen     = dayLen / 8;
    const dayCodes   = CHOGHADIYA_DAY[weekday] ?? CHOGHADIYA_DAY[0]!;

    for (let i = 0; i < 8; i++) {
      const code = dayCodes[i] ?? 'U';
      const q    = CHOGHADIYA_QUALITY[code]!;
      if (q.quality !== 'inauspicious') {
        const startH = srUTC + i * segLen;
        const endH   = startH + segLen;
        auspiciousSlots.push({
          name:       `${q.name} Choghadiya`,
          startLocal: fracHoursToStr(startH + tzOffset) ?? '',
          endLocal:   fracHoursToStr(endH + tzOffset) ?? '',
          quality:    q.quality,
        });
      }
    }

    // Abhijit Muhurat (±24 min around solar noon)
    const solarNoon = sunTimes.solarNoonUTC;
    auspiciousSlots.push({
      name:       'Abhijit Muhurat',
      startLocal: fracHoursToStr(solarNoon - 0.4 + tzOffset) ?? '',
      endLocal:   fracHoursToStr(solarNoon + 0.4 + tzOffset) ?? '',
      quality:    'excellent',
    });

    // Rahu Kaal — mark as inauspicious so consumer can exclude
    const rahuSeg  = RAHU_KAAL_SEGMENT[weekdayFromJD(jdMidnight)] ?? 1;
    const rahuStart = srUTC + (rahuSeg - 1) * segLen;
    auspiciousSlots.push({
      name:       'Rahu Kaal (avoid)',
      startLocal: fracHoursToStr(rahuStart + tzOffset) ?? '',
      endLocal:   fracHoursToStr(rahuStart + segLen + tzOffset) ?? '',
      quality:    'inauspicious',
    });
  }

  const naksh   = getNakshatra(moonAtSr.longitude);
  const sunLon  = sunAtSr.longitude;
  const moonLon = moonAtSr.longitude;
  const tithiRaw = calcTithi(sunLon, moonLon);

  const weekdayIdx = weekdayFromJD(jdMidnight);

  return {
    date:          dateStr,
    weekday:       WEEKDAY_NAMES[weekdayIdx] ?? 'Unknown',
    moonNakshatra: { name: naksh.name, index: naksh.index, pada: naksh.pada, lord: naksh.lord },
    moonSign:      moonAtSr.sign,
    tithi:         { name: tithiRaw.name, paksha: tithiRaw.paksha, pakshaIndex: tithiRaw.pakshaIndex },
    sunrise:       fracHoursToStr(srUTC + tzOffset),
    sunset:        fracHoursToStr(ssUTC + tzOffset),
    planets,
    events,
    auspiciousSlots,
  };
}

// ── Monthly row (lighter weight) ──────────────────────────────────────────────

async function calcMonthlyRow(
  jdMidnight: number,
  lat: number,
  lon: number,
  tzOffset: number,
  ayanamsa: AyanamsaName,
  _natalAscSignIdx: number,
  natalPlanets: PlanetPosition[],
  prevMoon?: { signIndex: number; longitude: number }
): Promise<MonthlyRow> {
  const swe = await import('swisseph');
  const srUTC    = (calcSunTimes(jdMidnight, lat, lon).sunriseUTC ?? 6);
  const jdSunrise = jdMidnight + srUTC / 24;
  const jdNoon    = jdMidnight + (12 - tzOffset) / 24;

  const [sunAtSr, moonAtSr] = await Promise.all([
    ephemerisService.calcPlanet(jdSunrise, swe.SE_SUN,  'Sun',  'sidereal', ayanamsa),
    ephemerisService.calcPlanet(jdSunrise, swe.SE_MOON, 'Moon', 'sidereal', ayanamsa),
  ]);

  const naksh   = getNakshatra(moonAtSr.longitude);
  const tithi   = calcTithi(sunAtSr.longitude, moonAtSr.longitude);
  const dateStr = toYMD(new Date((jdMidnight - 2440587.5) * 86400000));
  const weekdayIdx = weekdayFromJD(jdMidnight);

  // Events: moon sign ingress + tight slow planet aspects to natal
  const events: TransitEvent[] = [];

  // Moon sign ingress
  if (prevMoon && prevMoon.signIndex !== moonAtSr.signIndex) {
    events.push({
      date: dateStr, eventType: 'sign_ingress', planet: 'Moon',
      description: `Moon enters ${moonAtSr.sign}`,
      detail: { fromSign: ZODIAC_SIGNS[prevMoon.signIndex] ?? '?', toSign: moonAtSr.sign },
    });
  }

  // Tight aspects from slow planets (compute once at noon)
  const slowPlanetPositions = await Promise.all(
    [swe.SE_SUN, swe.SE_MARS, swe.SE_JUPITER, swe.SE_SATURN].map((id, i) =>
      ephemerisService.calcPlanet(jdNoon, id, ['Sun','Mars','Jupiter','Saturn'][i]!, 'sidereal', ayanamsa)
    )
  );

  const MAJOR_ASPECTS = [0, 60, 90, 120, 180];
  const ASPECT_NAMES: Record<number, string> = { 0:'Conjunction', 60:'Sextile', 90:'Square', 120:'Trine', 180:'Opposition' };
  for (const tp of slowPlanetPositions) {
    for (const np of natalPlanets) {
      if (!SLOW_PLANETS.includes(np.planet)) continue;
      for (const angle of MAJOR_ASPECTS) {
        const orb = Math.abs(Math.abs(angleDiff(tp.longitude, np.longitude)) - angle);
        if (orb <= 1.5) {
          events.push({
            date: dateStr, eventType: 'tight_natal_aspect', planet: tp.planet,
            description: `T:${tp.planet} ${ASPECT_NAMES[angle]} N:${np.planet} (${orb.toFixed(2)}°)`,
            detail: { transitPlanet: tp.planet, natalPlanet: np.planet, aspect: ASPECT_NAMES[angle], orb: Number(orb.toFixed(2)), angle },
          });
          break;
        }
      }
    }
  }

  return {
    date:          dateStr,
    weekday:       WEEKDAY_NAMES[weekdayIdx] ?? 'Unknown',
    moonNakshatra: naksh.name,
    moonSign:      moonAtSr.sign,
    tithi:         `${tithi.paksha} ${tithi.name}`,
    moonLongitude: Number(moonAtSr.longitude.toFixed(4)),
    events,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface HoroscopeInput {
  natalPlanets:    PlanetPosition[];
  natalAscSignIdx: number;
  lat:             number;
  lon:             number;
  timezone:        string;
  ayanamsa:        AyanamsaName;
  period:          HoroscopePeriod;
  /** Override start date; default = today (period=daily/tomorrow use this). YYYY-MM-DD */
  startDate?:      string;
}

export async function calcHoroscope(input: HoroscopeInput): Promise<HoroscopeResult> {
  const { natalPlanets, natalAscSignIdx, lat, lon, timezone, ayanamsa, period } = input;
  const tzOffset = parseTzOffset(timezone);
  const swe      = await import('swisseph');

  const today = input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const natalMoon    = natalPlanets.find((p) => p.planet === 'Moon');
  const natalAscSign = ZODIAC_SIGNS[natalAscSignIdx] ?? 'Unknown';
  const natalSummary = {
    ascendantSign:   natalAscSign,
    moonSign:        natalMoon?.sign ?? 'Unknown',
    moonNakshatra:   natalMoon ? getNakshatra(natalMoon.longitude).name : 'Unknown',
  };

  function jdForDate(d: Date): number {
    const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
    return swe.swe_julday(y, m, day, 0, swe.SE_GREG_CAL);
  }

  if (period === 'daily' || period === 'tomorrow') {
    const startD = period === 'tomorrow' ? addDays(today, 1) : today;
    const jdDay  = jdForDate(startD);

    // Get yesterday's planets for event detection
    const jdYesterday = jdDay - 1;
    const jdNoon = jdYesterday + (12 - tzOffset) / 24;
    const yesterdayPlanets = await buildPrevDaySnapshots(jdNoon, ayanamsa, natalAscSignIdx, swe);

    const row = await calcDaySnapshot(jdDay, lat, lon, tzOffset, ayanamsa, natalAscSignIdx, natalPlanets, true, yesterdayPlanets);
    return { period, generatedFor: toYMD(startD), natalSummary, daily: row };
  }

  if (period === 'weekly') {
    const rows: DailyHoroscopeRow[] = [];
    let prevPlanets: TransitPlanetSnapshot[] | undefined;

    for (let i = 0; i < 7; i++) {
      const d   = addDays(today, i);
      const jd  = jdForDate(d);
      const row = await calcDaySnapshot(jd, lat, lon, tzOffset, ayanamsa, natalAscSignIdx, natalPlanets, true, prevPlanets);
      prevPlanets = row.planets;
      rows.push(row);
    }
    return { period, generatedFor: toYMD(today), natalSummary, weekly: rows };
  }

  if (period === 'monthly') {
    const rows: MonthlyRow[] = [];
    let prevMoon: { signIndex: number; longitude: number } | undefined;

    for (let i = 0; i < 30; i++) {
      const d   = addDays(today, i);
      const jd  = jdForDate(d);
      const row = await calcMonthlyRow(jd, lat, lon, tzOffset, ayanamsa, natalAscSignIdx, natalPlanets, prevMoon);
      prevMoon  = { signIndex: Math.floor(row.moonLongitude / 30), longitude: row.moonLongitude };
      rows.push(row);
    }
    return { period, generatedFor: toYMD(today), natalSummary, monthly: rows };
  }

  // yearly — 12 monthly summaries
  const monthlySummaries: YearlyMonthSummary[] = [];
  const SLOW_PLANET_IDS = [
    { id: swe.SE_SUN, name: 'Sun' }, { id: swe.SE_MARS, name: 'Mars' },
    { id: swe.SE_JUPITER, name: 'Jupiter' }, { id: swe.SE_SATURN, name: 'Saturn' },
    { id: swe.SE_MEAN_NODE, name: 'Rahu' },
  ];

  for (let m = 0; m < 12; m++) {
    const d   = new Date(today);
    d.setUTCMonth(d.getUTCMonth() + m, 1);
    const jd  = jdForDate(d);
    const jdNoon = jd + (12 - tzOffset) / 24;

    const monthKey = toYMD(d).slice(0, 7);
    const slowSnaps = await Promise.all(
      SLOW_PLANET_IDS.map(({ id, name }) =>
        ephemerisService.calcPlanet(jdNoon, id, name, 'sidereal', ayanamsa)
      )
    );

    // Rahu/Ketu
    const rahuSnap = slowSnaps.find((p) => p.planet === 'Rahu')!;
    const ketuLon  = normalize360(rahuSnap.longitude + 180);
    const ketuSnap = { planet: 'Ketu', sign: ZODIAC_SIGNS[Math.floor(ketuLon / 30)] ?? 'Unknown', isRetrograde: true };

    const slowPlanets = [
      ...slowSnaps.map((p) => ({ planet: p.planet, sign: p.sign, isRetrograde: p.isRetrograde })),
      { planet: ketuSnap.planet, sign: ketuSnap.sign, isRetrograde: ketuSnap.isRetrograde },
    ];

    // Moon ingresses (sample 4 dates in the month at 7-day intervals)
    const moonIngresses: Array<{ date: string; nakshatra: string; sign: string }> = [];
    for (let w = 0; w < 4; w++) {
      const wd  = addDays(d, w * 7);
      const wjd = jdForDate(wd);
      const srUTC = calcSunTimes(wjd, lat, lon).sunriseUTC ?? 6;
      const moonP = await ephemerisService.calcPlanet(wjd + srUTC / 24, swe.SE_MOON, 'Moon', 'sidereal', ayanamsa);
      moonIngresses.push({
        date: toYMD(wd),
        nakshatra: getNakshatra(moonP.longitude).name,
        sign: moonP.sign,
      });
    }

    // Tight aspects for this month
    const events: TransitEvent[] = [];
    for (const tp of slowSnaps) {
      for (const np of natalPlanets) {
        for (const angle of [0, 90, 120, 180]) {
          const ASPECT_NAMES: Record<number, string> = { 0:'Conjunction', 90:'Square', 120:'Trine', 180:'Opposition' };
          const orb = Math.abs(Math.abs(angleDiff(tp.longitude, np.longitude)) - angle);
          if (orb <= 2.0) {
            events.push({
              date: toYMD(d), eventType: 'tight_natal_aspect', planet: tp.planet,
              description: `T:${tp.planet} ${ASPECT_NAMES[angle]} N:${np.planet} (${orb.toFixed(2)}°)`,
              detail: { transitPlanet: tp.planet, natalPlanet: np.planet, aspect: ASPECT_NAMES[angle], orb: Number(orb.toFixed(2)), angle },
            });
            break;
          }
        }
      }
    }

    monthlySummaries.push({ month: monthKey, slowPlanets, moonIngresses, events });
  }

  return { period, generatedFor: toYMD(today), natalSummary, yearly: monthlySummaries };
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function buildPrevDaySnapshots(
  jdNoon: number,
  ayanamsa: AyanamsaName,
  natalAscSignIdx: number,
  swe: Awaited<typeof import('swisseph')>
): Promise<TransitPlanetSnapshot[]> {
  const PLANET_IDS = [
    { id: swe.SE_SUN, name: 'Sun' }, { id: swe.SE_MOON, name: 'Moon' },
    { id: swe.SE_MERCURY, name: 'Mercury' }, { id: swe.SE_VENUS, name: 'Venus' },
    { id: swe.SE_MARS, name: 'Mars' }, { id: swe.SE_JUPITER, name: 'Jupiter' },
    { id: swe.SE_SATURN, name: 'Saturn' }, { id: swe.SE_MEAN_NODE, name: 'Rahu' },
  ];
  const planets = await Promise.all(
    PLANET_IDS.map(({ id, name }) =>
      ephemerisService.calcPlanet(jdNoon, id, name, 'sidereal', ayanamsa)
    )
  );
  return planets.map((p) => ({
    planet: p.planet, longitude: p.longitude, sign: p.sign, signIndex: p.signIndex,
    degreeInSign: p.degreeInSign, dmsFormatted: p.dms.formatted,
    isRetrograde: p.isRetrograde, speed: p.speed,
    natalHouse: whichNatalHouse(p.longitude, natalAscSignIdx),
  }));
}
