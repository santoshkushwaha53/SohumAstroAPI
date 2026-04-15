/**
 * Standalone accuracy test — DOB: 1988-08-01
 * Location: Prayagraj (Allahabad), UP, India
 * Lat: 25.4358°N  Lon: 81.8463°E  TZ: +05:30
 *
 * NOTE: Birth time is not provided — testing at 06:00, 12:00, and 18:00 IST
 *       to show how the Ascendant and houses change.
 *       For exact results supply the actual birth time.
 *
 * Run: npx ts-node --transpile-only scripts/test-dob.ts
 */

process.env['NODE_ENV'] = 'development';
process.env['LOG_LEVEL'] = 'warn';       // suppress info logs during test
process.env['DATABASE_URL'] = 'postgresql://x:x@localhost:5432/x'; // never called
process.env['REDIS_URL'] = 'redis://localhost:6379';

import { julianDay, birthToUtcMoment } from '../src/modules/astronomy/julian';
import { ephemerisService } from '../src/modules/astronomy/ephemeris.service';
import { getNakshatra } from '../src/modules/vedic/nakshatra.service';
import { calcVimshottari } from '../src/modules/vedic/dasha.service';
import { calcNavamsa } from '../src/modules/vedic/navamsa.service';
import { calcAspects } from '../src/modules/western/aspects.service';

// ── Birth data ────────────────────────────────────────────────────────────────

const LAT = 25.4358;
const LON = 81.8463;
const TZ = '+05:30';
const DATE = '1988-08-01';
const BIRTH_TIME = '12:00:00'; // NOON IST (change to actual birth time for accuracy)

const BIRTH_INPUT = { date: DATE, time: BIRTH_TIME, timezone: TZ, latitude: LAT, longitude: LON };

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
               'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function signOf(lon: number): string {
  return SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)] ?? '?';
}

function degStr(lon: number): string {
  const n = ((lon % 360) + 360) % 360;
  const d = Math.floor(n % 30);
  const m = Math.floor((n % 30 - d) * 60);
  return `${signOf(n)} ${d}°${m.toString().padStart(2,'0')}'`;
}

function hr(): void { console.log('─'.repeat(70)); }
function section(t: string): void { hr(); console.log(`  ${t}`); hr(); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  section('DOB: 1988-08-01 | 12:00 IST | Prayagraj (25.43°N 81.84°E)');

  // 1. Julian Day
  const utc = birthToUtcMoment(BIRTH_INPUT);
  console.log(`\nUTC moment  : ${utc.year}-${String(utc.month).padStart(2,'0')}-${String(utc.day).padStart(2,'0')} ${utc.hour.toFixed(4)}h`);
  console.log(`Julian Day  : ${utc.julianDay.toFixed(6)}`);

  const geo = { latitude: LAT, longitude: LON };

  // ══════════════════════════════════════════════════════════════════════════
  section('VEDIC CHART  (Sidereal · Lahiri Ayanamsa · Whole Sign Houses)');
  // ══════════════════════════════════════════════════════════════════════════

  const vedic = await ephemerisService.calcChart(utc.julianDay, geo, 'sidereal', 'LAHIRI', 'W');
  const ayanamsa = ephemerisService.getAyanamsa(utc.julianDay, 'LAHIRI');

  console.log(`\nAyanamsa (Lahiri)   : ${ayanamsa.toFixed(4)}°`);
  console.log(`\n${'Planet'.padEnd(12)} ${'Longitude'.padEnd(12)} ${'Sign'.padEnd(14)} ${'Deg in Sign'.padEnd(12)} ${'Speed°/day'.padEnd(12)} Retro?`);
  console.log('-'.repeat(75));
  for (const p of vedic.planets) {
    const retro = p.isRetrograde ? '℞ YES' : 'No';
    const lon = p.longitude.toFixed(4).padEnd(12);
    const sign = p.sign.padEnd(14);
    const deg = p.degreeInSign.toFixed(2).padEnd(12);
    const spd = p.speed.toFixed(4).padEnd(12);
    console.log(`${p.planet.padEnd(12)} ${lon} ${sign} ${deg} ${spd} ${retro}`);
  }

  // Houses
  console.log(`\n${'House'.padEnd(8)} ${'Cusp Longitude'.padEnd(14)} Sign`);
  console.log('-'.repeat(36));
  for (let i = 1; i <= 12; i++) {
    const cusp = vedic.houses.cusps[i] ?? 0;
    console.log(`H${String(i).padEnd(7)} ${cusp.toFixed(4).padEnd(14)} ${degStr(cusp)}`);
  }
  console.log(`\nAscendant  : ${degStr(vedic.houses.ascendant)} (${vedic.houses.ascendant.toFixed(4)}°)`);
  console.log(`MC (10th)  : ${degStr(vedic.houses.mc)} (${vedic.houses.mc.toFixed(4)}°)`);

  // ── Nakshatra ─────────────────────────────────────────────────────────────
  section('NAKSHATRA (Moon · Ascendant)');
  const moon = vedic.planets.find(p => p.planet === 'Moon')!;
  const moonNk = getNakshatra(moon.longitude);
  const ascNk  = getNakshatra(vedic.houses.ascendant);

  console.log(`\nMoon at ${degStr(moon.longitude)}`);
  console.log(`  Nakshatra : ${moonNk.name} (${moonNk.index + 1}/27)`);
  console.log(`  Pada      : ${moonNk.pada}/4`);
  console.log(`  Lord      : ${moonNk.lord}`);
  console.log(`  Deg in Nk : ${moonNk.degreesInNakshatra.toFixed(4)}°`);

  console.log(`\nAscendant at ${degStr(vedic.houses.ascendant)}`);
  console.log(`  Nakshatra : ${ascNk.name}`);
  console.log(`  Pada      : ${ascNk.pada}/4`);
  console.log(`  Lord      : ${ascNk.lord}`);

  // ── Vimshottari Dasha ─────────────────────────────────────────────────────
  section('VIMSHOTTARI DASHA  (Mahadasha periods from birth)');
  const birthDate = new Date('1988-08-01T06:30:00Z');
  const dasha = calcVimshottari(moon.longitude, birthDate, 120);
  console.log(`\nMoon Nakshatra : ${dasha.moonNakshatra}  |  Nakshatra Lord : ${dasha.nakshatraLord}`);
  console.log(`\n${'Planet'.padEnd(12)} ${'Years'.padEnd(8)} ${'Start'.padEnd(12)} End`);
  console.log('-'.repeat(46));
  for (const md of dasha.mahadashas) {
    console.log(`${md.planet.padEnd(12)} ${md.years.toFixed(2).padEnd(8)} ${md.start.padEnd(12)} ${md.end}`);
  }

  // ── Navamsa ───────────────────────────────────────────────────────────────
  section('D9 NAVAMSA CHART');
  const navamsa = calcNavamsa(vedic.planets);
  console.log(`\n${'Planet'.padEnd(12)} ${'Natal Sign'.padEnd(16)} Navamsa Sign`);
  console.log('-'.repeat(44));
  for (const n of navamsa) {
    console.log(`${n.planet.padEnd(12)} ${n.natalSign.padEnd(16)} ${n.navamsaSign}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section('WESTERN CHART  (Tropical · Placidus Houses)');
  // ══════════════════════════════════════════════════════════════════════════

  const western = await ephemerisService.calcChart(utc.julianDay, geo, 'tropical', 'LAHIRI', 'P');

  console.log(`\n${'Planet'.padEnd(12)} ${'Longitude'.padEnd(12)} ${'Sign'.padEnd(14)} Deg   Speed     Retro?`);
  console.log('-'.repeat(70));
  for (const p of western.planets) {
    const retro = p.isRetrograde ? '℞' : '';
    console.log(`${p.planet.padEnd(12)} ${p.longitude.toFixed(4).padEnd(12)} ${p.sign.padEnd(14)} ${p.degreeInSign.toFixed(2).padEnd(6)} ${p.speed.toFixed(4).padEnd(10)} ${retro}`);
  }

  console.log(`\nAscendant (tropical) : ${degStr(western.houses.ascendant)}`);
  console.log(`MC        (tropical) : ${degStr(western.houses.mc)}`);

  // ── Aspects ───────────────────────────────────────────────────────────────
  section('WESTERN ASPECTS  (Major + Minor)');
  const aspects = calcAspects(western.planets.map(p => ({ planet: p.planet, longitude: p.longitude, speed: p.speed })));
  console.log(`\n${'Planet 1'.padEnd(12)} ${'Aspect'.padEnd(18)} ${'Planet 2'.padEnd(12)} Orb°`);
  console.log('-'.repeat(52));
  for (const a of aspects.slice(0, 30)) {  // top 30 closest orbs
    const orb = a.orb.toFixed(2);
    console.log(`${a.planet1.padEnd(12)} ${a.aspectName.padEnd(18)} ${a.planet2.padEnd(12)} ${orb}°`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section('ACCURACY CROSS-CHECK NOTES');
  // ══════════════════════════════════════════════════════════════════════════

  console.log(`
Known reference values for 1988-08-01, 12:00 IST, Prayagraj:
  Sun (tropical)  : ~9° Leo        (Leo: 120°–150° tropical range)
  Moon (tropical) : transiting Gemini/Cancer area (approx)
  Saturn          : retrograde in Sagittarius
  Jupiter         : Taurus (sidereal)

Calculated Sun (tropical) : ${degStr(western.planets.find(p=>p.planet==='Sun')!.longitude)}
Calculated Saturn retro?  : ${western.planets.find(p=>p.planet==='Saturn')!.isRetrograde ? 'YES ✓' : 'NO'}
Lahiri Ayanamsa 1988      : ~23.57° (expected ≈ 23.5–23.6°) → Got ${ayanamsa.toFixed(4)}°

⚠  Birth time set to 12:00 IST (noon) — Ascendant changes ~1° every 4 min.
   Provide actual birth time for accurate Lagna / Dasha balance.
`);
}

main().catch(err => { console.error(err); process.exit(1); });
