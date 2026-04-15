/**
 * Panchang (Hindu almanac) raw data calculator.
 *
 * All values are rule-based, deterministic, and source-traceable.
 * NO interpretation. Returns enumerated codes + names only.
 *
 * Components:
 *   1. Tithi      — lunar day (Moon − Sun elongation / 12°)
 *   2. Nakshatra  — Moon's lunar mansion at sunrise
 *   3. Yoga       — (Sun + Moon) / 13.333° nakshatra-index
 *   4. Karana     — half-tithi (60 karanas per lunar month)
 *   5. Vara       — weekday (from Julian Day)
 *   6. Paksha     — fortnight (Shukla / Krishna)
 *   7. Rahu Kaal  — inauspicious period (weekday-based day fraction)
 *   8. Gulika Kaal
 *   9. Yamaganda
 *  10. Abhijit Muhurat — ±24 min around solar noon
 *  11. Hora       — 24 planetary hours (12 day + 12 night), Chaldean order
 *  12. Choghadiya — 8-fold day/night divisions, quality labels
 */

import { ephemerisService, normalize360 } from '../astronomy/ephemeris.service';
import { getNakshatra } from '../vedic/nakshatra.service';
import { calcSunTimes, toLocalTimeStr, hoursToTimeStr } from './sunrise';
import type { AyanamsaName } from '../astronomy/types';

// ── Lookup tables ─────────────────────────────────────────────────────────────

const TITHI_NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima / Amavasya',
];

const YOGA_NAMES = [
  'Vishkumbha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
  'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda',
  'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
  'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva',
  'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
  'Indra', 'Vaidhriti',
];

// 11 Karana types: 4 fixed + 7 movable (cycling 8 times = 56 movable)
const MOVABLE_KARANAS = ['Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti'];
const FIXED_KARANAS   = ['Shakuni','Chatushpada','Naga','Kimstughna'];

const WEEKDAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Rahu Kaal: which 1/8th segment of the day is inauspicious (1-indexed)
// Order: Sun=8th, Mon=2nd, Tue=7th, Wed=5th, Thu=6th, Fri=4th, Sat=3rd
const RAHU_KAAL_SEGMENT: Record<number, number> = { 0:8, 1:2, 2:7, 3:5, 4:6, 5:4, 6:3 };
const GULIKA_SEGMENT:    Record<number, number> = { 0:7, 1:6, 2:5, 3:4, 4:3, 5:2, 6:1 };
const YAMAGANDA_SEGMENT: Record<number, number> = { 0:4, 1:3, 2:2, 3:1, 4:8, 5:7, 6:6 };

// Hora (planetary hour) order — Chaldean sequence
const HORA_PLANETS = ['Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon'];
// First hora of each weekday (0=Sun…6=Sat) is ruled by the day's planet:
// Sun→Sun(3), Mon→Moon(6), Tue→Mars(2), Wed→Mercury(5), Thu→Jupiter(1), Fri→Venus(4), Sat→Saturn(0)
const DAY_HORA_START: Record<number, number> = { 0:3, 1:6, 2:2, 3:5, 4:1, 5:4, 6:0 };

// Choghadiya quality labels (Day and Night sequences indexed by weekday)
// Encoding: U=Udveg, C=Char, L=Labh, A=Amrit, K=Kaal, S=Shubh, R=Rog
// Day choghadiya sequence by weekday (starts at sunrise, 8 slots):
const CHOGHADIYA_DAY: Record<number, string[]> = {
  0: ['U','S','L','A','K','S','R','C'],   // Sunday
  1: ['A','K','S','R','C','U','S','L'],   // Monday
  2: ['R','C','U','S','L','A','K','S'],   // Tuesday
  3: ['S','L','A','K','S','R','C','U'],   // Wednesday
  4: ['K','S','R','C','U','S','L','A'],   // Thursday
  5: ['C','U','S','L','A','K','S','R'],   // Friday
  6: ['L','A','K','S','R','C','U','S'],   // Saturday
};
// Night choghadiya sequence by weekday:
const CHOGHADIYA_NIGHT: Record<number, string[]> = {
  0: ['S','R','C','U','S','L','A','K'],
  1: ['L','A','K','S','R','C','U','S'],
  2: ['K','S','R','C','U','S','L','A'],
  3: ['C','U','S','L','A','K','S','R'],
  4: ['A','K','S','R','C','U','S','L'],
  5: ['U','S','L','A','K','S','R','C'],
  6: ['R','C','U','S','L','A','K','S'],
};
const CHOGHADIYA_QUALITY: Record<string, string> = {
  U: 'Udveg',    // Inauspicious (ruled by Sun)
  C: 'Char',     // Neutral, good for travel (ruled by Moon)
  L: 'Labh',     // Auspicious, gains (ruled by Mercury)
  A: 'Amrit',    // Excellent, nectar (ruled by Moon)
  K: 'Kaal',     // Inauspicious (ruled by Saturn)
  S: 'Shubh',    // Auspicious (ruled by Jupiter)
  R: 'Rog',      // Inauspicious (ruled by Mars)
};

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface TithiResult {
  index:       number;   // 0–29 (0=Shukla Pratipada … 14=Purnima, 15=Krishna Pratipada … 29=Amavasya)
  name:        string;
  paksha:      'Shukla' | 'Krishna';
  pakshaIndex: number;   // 1–15 within paksha
  elongation:  number;   // Moon − Sun degrees (0–360)
  degreeInTithi: number; // 0–12 how far into current tithi
}

export interface YogaResult {
  index: number;   // 0–26
  name:  string;
  value: number;   // (Sun + Moon) % 360
}

export interface KaranaResult {
  index:       number;   // 0–59 (karana number in the lunar month)
  name:        string;
  isFixed:     boolean;
  halfTithi:   number;   // 1 = first half of tithi, 2 = second half
}

export interface TimeWindow {
  startUTC:   string;   // "HH:MM:SS"
  endUTC:     string;
  startLocal: string;
  endLocal:   string;
}

export interface HoraWindow extends TimeWindow {
  planet: string;
  index:  number;   // 1–24
}

export interface ChoghadiyaWindow extends TimeWindow {
  code:    string;   // 'U','C','L','A','K','S','R'
  name:    string;
  period:  'day' | 'night';
  index:   number;   // 1–8 within period
}

export interface PanchangResult {
  date:       string;
  weekday:    { index: number; name: string };
  sunrise:    { utc: string | null; local: string | null };
  sunset:     { utc: string | null; local: string | null };
  solarNoon:  { utc: string; local: string };
  dayLength:  string | null;   // "HH:MM:SS"
  tithi:      TithiResult;
  nakshatra:  ReturnType<typeof getNakshatra>;
  yoga:       YogaResult;
  karana:     KaranaResult;
  rahuKaal:   TimeWindow;
  gulikaKaal: TimeWindow;
  yamaganda:  TimeWindow;
  abhijitMuhurat: TimeWindow;
  horas:      HoraWindow[];
  choghadiyas: ChoghadiyaWindow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseTzOffset(tz: string): number {
  if (!tz || tz === 'UTC' || tz === 'Z' || tz === '+00:00') return 0;
  const m = tz.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid timezone: "${tz}"`);
  return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) + parseInt(m[3]) / 60);
}

function fractionalHoursToTimeStr(h: number): string {
  const t  = Math.round(((h % 24) + 24) % 24 * 3600);
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function buildWindow(startUTCh: number, endUTCh: number, tzOffset: number): TimeWindow {
  return {
    startUTC:   fractionalHoursToTimeStr(startUTCh),
    endUTC:     fractionalHoursToTimeStr(endUTCh),
    startLocal: fractionalHoursToTimeStr(startUTCh + tzOffset),
    endLocal:   fractionalHoursToTimeStr(endUTCh + tzOffset),
  };
}

/** Get weekday from Julian Day (0=Sun, 1=Mon, …, 6=Sat). */
function weekdayFromJD(jd: number): number {
  return Math.floor(jd + 1.5) % 7;
}

/** Build an N-segment time division from startH to endH. */
function buildSegments(startH: number, endH: number, n: number): Array<{start: number; end: number}> {
  const segLen = (endH - startH) / n;
  return Array.from({ length: n }, (_, i) => ({
    start: startH + i * segLen,
    end:   startH + (i + 1) * segLen,
  }));
}

// ── Individual calculators ────────────────────────────────────────────────────

export function calcTithi(sunLon: number, moonLon: number): TithiResult {
  const elongation    = normalize360(moonLon - sunLon);
  const index         = Math.floor(elongation / 12);       // 0–29
  const degreeInTithi = elongation % 12;
  const paksha        = index < 15 ? 'Shukla' : 'Krishna';
  const pakshaIndex   = index < 15 ? index + 1 : index - 15 + 1;
  const tithiNameIdx  = index % 15;
  const name          = tithiNameIdx === 14
    ? (paksha === 'Shukla' ? 'Purnima' : 'Amavasya')
    : (TITHI_NAMES[tithiNameIdx] ?? `Tithi ${tithiNameIdx + 1}`);
  return { index, name, paksha, pakshaIndex, elongation: Number(elongation.toFixed(6)), degreeInTithi: Number(degreeInTithi.toFixed(6)) };
}

export function calcYoga(sunLon: number, moonLon: number): YogaResult {
  const value = normalize360(sunLon + moonLon);
  const index = Math.floor(value / (360 / 27));  // 0–26
  return { index, name: YOGA_NAMES[index] ?? `Yoga ${index + 1}`, value: Number(value.toFixed(6)) };
}

export function calcKarana(sunLon: number, moonLon: number): KaranaResult {
  const elongation = normalize360(moonLon - sunLon);
  // Each karana = 6°; 60 karanas per lunar month
  const karanaSeq = Math.floor(elongation / 6);  // 0–59

  let name: string;
  let isFixed: boolean;

  if (karanaSeq === 0) {
    // 1st karana of the lunar month: Kimstughna (fixed)
    name = 'Kimstughna'; isFixed = true;
  } else if (karanaSeq >= 57) {
    // Last 3 karanas: Shakuni, Chatushpada, Naga (fixed)
    name = FIXED_KARANAS[karanaSeq - 57] ?? 'Unknown'; isFixed = true;
  } else {
    // Movable karanas cycle through 7 types
    name = MOVABLE_KARANAS[(karanaSeq - 1) % 7] ?? 'Unknown'; isFixed = false;
  }

  return {
    index:      karanaSeq,
    name,
    isFixed,
    halfTithi:  (karanaSeq % 2 === 0) ? 2 : 1,
  };
}

function calcInauspiciousPeriod(
  segment: number,
  sunriseH: number,
  dayDurationH: number,
  tzOffset: number
): TimeWindow {
  const segLen = dayDurationH / 8;
  const startH = sunriseH + (segment - 1) * segLen;
  const endH   = startH + segLen;
  return buildWindow(startH, endH, tzOffset);
}

function calcHoras(sunriseH: number, sunsetH: number, nextSunriseH: number, weekday: number, tzOffset: number): HoraWindow[] {
  const dayLen   = (sunsetH - sunriseH) / 12;
  const nightLen = (nextSunriseH - sunsetH) / 12;

  const horas: HoraWindow[] = [];
  const startIdx = DAY_HORA_START[weekday] ?? 0;

  for (let i = 0; i < 24; i++) {
    const planetIdx = (startIdx + i) % 7;  // Chaldean cycle
    const isDay     = i < 12;
    const startH    = isDay
      ? sunriseH + i * dayLen
      : sunsetH + (i - 12) * nightLen;
    const endH      = isDay
      ? sunriseH + (i + 1) * dayLen
      : sunsetH + (i - 11) * nightLen;

    horas.push({
      ...buildWindow(startH, endH, tzOffset),
      planet: HORA_PLANETS[planetIdx] ?? 'Unknown',
      index:  i + 1,
    });
  }

  return horas;
}

function calcChoghadiyas(
  sunriseH: number, sunsetH: number, nextSunriseH: number,
  weekday: number, tzOffset: number
): ChoghadiyaWindow[] {
  const daySegs   = buildSegments(sunriseH,  sunsetH,      8);
  const nightSegs = buildSegments(sunsetH,   nextSunriseH, 8);

  const dayCodes   = CHOGHADIYA_DAY[weekday]   ?? CHOGHADIYA_DAY[0]!;
  const nightCodes = CHOGHADIYA_NIGHT[weekday] ?? CHOGHADIYA_NIGHT[0]!;

  const result: ChoghadiyaWindow[] = [];

  daySegs.forEach((seg, i) => {
    const code = dayCodes[i] ?? 'U';
    result.push({ ...buildWindow(seg.start, seg.end, tzOffset), code, name: CHOGHADIYA_QUALITY[code] ?? code, period: 'day', index: i + 1 });
  });
  nightSegs.forEach((seg, i) => {
    const code = nightCodes[i] ?? 'U';
    result.push({ ...buildWindow(seg.start, seg.end, tzOffset), code, name: CHOGHADIYA_QUALITY[code] ?? code, period: 'night', index: i + 1 });
  });

  return result;
}

// ── Main panchang function ────────────────────────────────────────────────────

export async function calcPanchang(
  date:      string,   // YYYY-MM-DD
  lat:       number,
  lon:       number,
  timezone:  string,   // "+05:30" etc.
  ayanamsa:  AyanamsaName = 'LAHIRI'
): Promise<PanchangResult> {
  const tzOffset = parseTzOffset(timezone);

  // Julian Day at midnight UTC of the requested date
  const [year, month, day] = date.split('-').map(Number);
  // Import swisseph directly for swe_julday
  const swe = await import('swisseph');
  const jdMidnight = swe.swe_julday(year!, month!, day!, 0, swe.SE_GREG_CAL);

  // Weekday
  const weekdayIndex = weekdayFromJD(jdMidnight);

  // Sunrise/sunset at the given date
  const sunTimes     = calcSunTimes(jdMidnight, lat, lon);
  // Next-day sunrise for hora/choghadiya night calculations
  const jdNextDay    = jdMidnight + 1;
  const nextSunTimes = calcSunTimes(jdNextDay, lat, lon);

  const srUTC = sunTimes.sunriseUTC  ?? 6;    // fallback 06:00 if polar
  const ssUTC = sunTimes.sunsetUTC   ?? 18;
  const nxtSrUTC = nextSunTimes.sunriseUTC ?? 30;  // ~30h = 06:00 next day

  const dayDuration = sunTimes.dayLength ?? 12;

  // ── Sun/Moon at sunrise for accurate tithi/yoga/karana/nakshatra ─────────
  // Traditional panchang values are assessed at the moment of sunrise, not noon.
  const jdSunrise = jdMidnight + srUTC / 24;
  const [sunAtSunrise, moonAtSunrise] = await Promise.all([
    ephemerisService.calcPlanet(jdSunrise, swe.SE_SUN,  'Sun',  'sidereal', ayanamsa),
    ephemerisService.calcPlanet(jdSunrise, swe.SE_MOON, 'Moon', 'sidereal', ayanamsa),
  ]);

  // ── Panchang components ──────────────────────────────────────────────────

  const tithi   = calcTithi(sunAtSunrise.longitude, moonAtSunrise.longitude);
  const naksh   = getNakshatra(moonAtSunrise.longitude);
  const yoga    = calcYoga(sunAtSunrise.longitude, moonAtSunrise.longitude);
  const karana  = calcKarana(sunAtSunrise.longitude, moonAtSunrise.longitude);

  // Inauspicious periods (based on sunrise + day duration)
  const rahuKaal  = calcInauspiciousPeriod(RAHU_KAAL_SEGMENT[weekdayIndex]  ?? 1, srUTC, dayDuration, tzOffset);
  const gulikaKaal= calcInauspiciousPeriod(GULIKA_SEGMENT[weekdayIndex]    ?? 1, srUTC, dayDuration, tzOffset);
  const yamaganda = calcInauspiciousPeriod(YAMAGANDA_SEGMENT[weekdayIndex] ?? 1, srUTC, dayDuration, tzOffset);

  // Abhijit Muhurat: 24 min before/after solar noon (48 min window)
  const noon = sunTimes.solarNoonUTC;
  const abhijitMuhurat = buildWindow(noon - 0.4, noon + 0.4, tzOffset);  // ±24 min

  // Horas & Choghadiyas
  const horas      = calcHoras(srUTC, ssUTC, nxtSrUTC, weekdayIndex, tzOffset);
  const choghadiyas = calcChoghadiyas(srUTC, ssUTC, nxtSrUTC, weekdayIndex, tzOffset);

  // Day length as HH:MM:SS
  const dlH  = Math.floor(dayDuration);
  const dlM  = Math.floor((dayDuration % 1) * 60);
  const dlS  = Math.round(((dayDuration % 1) * 60 % 1) * 60);
  const dayLengthStr = `${String(dlH).padStart(2,'0')}:${String(dlM).padStart(2,'0')}:${String(dlS).padStart(2,'0')}`;

  return {
    date,
    weekday: { index: weekdayIndex, name: WEEKDAY_NAMES[weekdayIndex] ?? 'Unknown' },
    sunrise: {
      utc:   hoursToTimeStr(sunTimes.sunriseUTC),
      local: toLocalTimeStr(sunTimes.sunriseUTC, tzOffset),
    },
    sunset: {
      utc:   hoursToTimeStr(sunTimes.sunsetUTC),
      local: toLocalTimeStr(sunTimes.sunsetUTC, tzOffset),
    },
    solarNoon: {
      utc:   fractionalHoursToTimeStr(noon),
      local: fractionalHoursToTimeStr(noon + tzOffset),
    },
    dayLength: sunTimes.dayLength !== null ? dayLengthStr : null,
    tithi,
    nakshatra: naksh,
    yoga,
    karana,
    rahuKaal,
    gulikaKaal,
    yamaganda,
    abhijitMuhurat,
    horas,
    choghadiyas,
  };
}
