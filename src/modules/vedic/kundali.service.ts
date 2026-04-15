/**
 * Full Kundali Report — bundles every Vedic calculation from a single birth input.
 *
 * Returns a machine-readable object containing all 10 layers:
 *  1. Birth chart (planets, houses, ascendant)
 *  2. Moon nakshatra + pada
 *  3. Vimshottari Dasha (3 levels: maha / antar / pratyantara)
 *  4. Navamsa (D9) + selected divisional charts (D1–D12)
 *  5. Yogas & Doshas
 *  6. Guna Milan compatibility (if partner data provided)
 *  7. Birth-moment Panchang
 *  8. Full Ashtakuta for provided partner (optional)
 *  9. Current + next 12-month transit horoscope
 * 10. Metadata (ayanamsa, Julian day, house system)
 *
 * This is the single "AI-input" document — everything an interpretation layer needs.
 */

import { calcVedicBirthChart }       from './birth-chart.service';
import { calcVimshottari }            from './dasha.service';
import { calcVargas, type VargaCode } from './vargas.service';
import { calcYogasAndDoshas }         from './yoga.service';
import { calcGunaMilan }              from './guna-milan.service';
import { calcHoroscope }              from './transit-horoscope.service';
import { calcPanchang }               from '../panchang/panchang.service';
import type { AyanamsaName }          from '../astronomy/types';
import type { BirthInput }            from '../shared/types';

export interface KundaliInput {
  natal:       BirthInput;
  ayanamsa:    AyanamsaName;
  houseSystem: string;
  /** Include pratyantardasha (3rd level)? default false */
  includePratyantardasha?: boolean;
  /** Optional partner for compatibility */
  partner?: BirthInput;
  /** Today's date for transit horoscope. YYYY-MM-DD. Defaults to today */
  transitDate?: string;
  /** Location for transit horoscope (defaults to natal location) */
  transitLat?: number;
  transitLon?: number;
  transitTimezone?: string;
}

export async function calcKundali(input: KundaliInput) {
  const { natal, ayanamsa, houseSystem } = input;

  // ── 1. Birth chart ────────────────────────────────────────────────────────
  const chart = await calcVedicBirthChart(natal, ayanamsa, houseSystem);
  const planets = chart.chart.planets;
  const ascSignIdx = Math.floor(chart.chart.houses.ascendant / 30);

  // ── 2. Moon nakshatra (already in chart) ──────────────────────────────────
  const moonNakshatra = chart.moonNakshatra;

  // ── 3. Dasha ──────────────────────────────────────────────────────────────
  const moon = planets.find((p) => p.planet === 'Moon');
  if (!moon) throw new Error('Moon not found');
  const birthDate = new Date(`${natal.date}T${natal.time ?? '12:00:00'}`);
  const dasha = calcVimshottari(moon.longitude, birthDate, 100, input.includePratyantardasha ?? false);

  // ── 4. Divisional charts ──────────────────────────────────────────────────
  const VARGA_SET: VargaCode[] = ['D1','D2','D3','D4','D7','D9','D10','D12'];
  const planetInputs = planets.map((p) => ({ planet: p.planet, longitude: p.longitude }));
  const vargas = calcVargas(planetInputs, VARGA_SET);

  // ── 5. Yogas & Doshas ────────────────────────────────────────────────────
  const yogas = calcYogasAndDoshas(planets);

  // ── 6. Partner compatibility (optional) ──────────────────────────────────
  let compatibility: ReturnType<typeof calcGunaMilan> | null = null;
  if (input.partner) {
    const partnerChart = await calcVedicBirthChart(input.partner, ayanamsa);
    const partnerMoon  = partnerChart.chart.planets.find((p) => p.planet === 'Moon');
    if (partnerMoon) {
      compatibility = calcGunaMilan(moon.longitude, partnerMoon.longitude);
    }
  }

  // ── 7. Birth-moment Panchang ──────────────────────────────────────────────
  const panchang = await calcPanchang(
    natal.date,
    natal.latitude,
    natal.longitude,
    natal.timezone ?? '+00:00',
    ayanamsa
  );

  // ── 8. Transit horoscope (next 30 days from today) ────────────────────────
  const transitDate   = input.transitDate ?? new Date().toISOString().slice(0, 10);
  const transitLat    = input.transitLat    ?? natal.latitude;
  const transitLon    = input.transitLon    ?? natal.longitude;
  const transitTz     = input.transitTimezone ?? natal.timezone ?? '+00:00';

  const transitHoroscope = await calcHoroscope({
    natalPlanets:    planets,
    natalAscSignIdx: ascSignIdx,
    lat:             transitLat,
    lon:             transitLon,
    timezone:        transitTz,
    ayanamsa,
    period:          'monthly',
    startDate:       transitDate,
  });

  // ── 9. Yearly transit events ──────────────────────────────────────────────
  const yearlyTransits = await calcHoroscope({
    natalPlanets:    planets,
    natalAscSignIdx: ascSignIdx,
    lat:             transitLat,
    lon:             transitLon,
    timezone:        transitTz,
    ayanamsa,
    period:          'yearly',
    startDate:       transitDate,
  });

  // ── Assemble full document ────────────────────────────────────────────────
  return {
    meta: {
      generatedAt:  new Date().toISOString(),
      ayanamsa:     { name: ayanamsa, value: chart.ayanamsa },
      houseSystem,
      julianDay:    chart.julianDay,
    },
    birthChart: {
      ascendant:          chart.chart.houses.ascendant,
      ascendantSign:      ZODIAC_SIGNS[ascSignIdx] ?? 'Unknown',
      ascendantSignIndex: ascSignIdx,
      mc:                 chart.chart.houses.mc,
      planets,
      houses:             chart.chart.houses,
      moonNakshatra,
      ascendantNakshatra: chart.ascendantNakshatra,
    },
    dasha: {
      moonNakshatra:   dasha.moonNakshatra,
      nakshatraLord:   dasha.nakshatraLord,
      dashaBalance:    dasha.dashaBalance,
      dashas:          dasha.dashas,
    },
    divisionalCharts: vargas,
    navamsa: vargas.find((v) => v.varga === 'D9')?.planets ?? [],
    yogasDoshas: yogas,
    birthPanchang: {
      date:     panchang.date,
      weekday:  panchang.weekday,
      tithi:    panchang.tithi,
      nakshatra: panchang.nakshatra,
      yoga:     panchang.yoga,
      karana:   panchang.karana,
      sunrise:  panchang.sunrise,
      rahuKaal: panchang.rahuKaal,
    },
    compatibility,
    transitHoroscope: {
      monthly: transitHoroscope.monthly ?? [],
      yearly:  yearlyTransits.yearly    ?? [],
    },
  };
}

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];
