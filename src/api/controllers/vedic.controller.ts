import type { Request, Response, NextFunction } from 'express';
import {
  AyanamsaQuerySchema,
  VedicBirthChartSchema,
  NakshatraSchema,
  VimshottariSchema,
  NavamsaSchema,
  VargasSchema,
  CompatibilitySchema,
  YogasSchema,
  HoroscopeSchema,
  KundaliSchema,
} from '../validators/vedic.validator';
import { birthToUtcMoment } from '../../modules/astronomy/julian';
import { ephemerisService } from '../../modules/astronomy/ephemeris.service';
import { calcVedicBirthChart } from '../../modules/vedic/birth-chart.service';
import { getNakshatra } from '../../modules/vedic/nakshatra.service';
import { calcVimshottari } from '../../modules/vedic/dasha.service';
import { calcNavamsa } from '../../modules/vedic/navamsa.service';
import { calcVargas, type VargaCode } from '../../modules/vedic/vargas.service';
import { calcGunaMilan } from '../../modules/vedic/guna-milan.service';
import { calcYogasAndDoshas } from '../../modules/vedic/yoga.service';
import { calcHoroscope, type HoroscopePeriod } from '../../modules/vedic/transit-horoscope.service';
import { calcKundali } from '../../modules/vedic/kundali.service';
import { generateKundaliExcel } from '../../modules/export/excel.service';
import { getOrSet } from '../../cache/redis.client';
import type { AyanamsaName } from '../../modules/astronomy/types';
import { buildResponse, buildCalcContext } from '../utils/response';

// ── POST /vedic/ayanamsa ──────────────────────────────────────────────────────

export async function getAyanamsa(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = AyanamsaQuerySchema.parse(req.body);
    const utc  = birthToUtcMoment({ date: body.date, time: body.time, timezone: body.timezone, latitude: 0, longitude: 0 });
    const value = ephemerisService.getAyanamsa(utc.julianDay, body.ayanamsa as AyanamsaName);
    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay: utc.julianDay,
        utcDateTime: new Date(`${body.date}T${body.time}Z`).toISOString(),
        mode: 'sidereal',
        ayanamsa: { name: body.ayanamsa, value },
      }),
      data: {
        julianDay: utc.julianDay,
        ayanamsa: {
          name:  body.ayanamsa,
          value: Number(value.toFixed(8)),
          unit:  'degrees',
          note:  'Precession offset: subtract from tropical longitude to get sidereal',
        },
      },
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/birth-chart ───────────────────────────────────────────────────

export async function getVedicBirthChart(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = VedicBirthChartSchema.parse(req.body);
    const cacheKey = `vedic:chart:${JSON.stringify(body)}`;
    const result = await getOrSet(cacheKey, 3600, () =>
      calcVedicBirthChart(body, body.ayanamsa as AyanamsaName, body.houseSystem)
    );
    const utc = birthToUtcMoment(body);
    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay:  result.julianDay,
        utcDateTime: `${utc.year}-${String(utc.month).padStart(2,'0')}-${String(utc.day).padStart(2,'0')}T${String(Math.floor(utc.hour)).padStart(2,'0')}:${String(Math.round((utc.hour%1)*60)).padStart(2,'0')}:00Z`,
        mode:       'sidereal',
        ayanamsa:   { name: body.ayanamsa, value: result.ayanamsa },
        houseSystem: body.houseSystem,
      }),
      data: {
        julianDay:          result.julianDay,
        ayanamsa:           result.ayanamsa,
        ayanamsaName:       result.ayanamsaName,
        chart:              result.chart,
        moonNakshatra:      result.moonNakshatra,
        ascendantNakshatra: result.ascendantNakshatra,
      },
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/nakshatra ─────────────────────────────────────────────────────

export async function getNakshatraHandler(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = NakshatraSchema.parse(req.body);

    if (body.mode === 'longitude') {
      const nk = getNakshatra(body.longitude);
      res.json(buildResponse({
        input: body,
        calculationContext: null,
        data: { inputLongitude: body.longitude, nakshatra: nk },
      }));
      return;
    }

    const cacheKey = `vedic:nakshatra:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const utc = birthToUtcMoment({ date: body.date, time: body.time, timezone: body.timezone, latitude: body.latitude, longitude: body.longitude });
      const planets = await ephemerisService.calcPlanets(utc.julianDay, 'sidereal', body.ayanamsa as AyanamsaName, [body.planet]);
      const planet  = planets[0];
      if (!planet) throw new Error(`Planet ${body.planet} not found`);
      return {
        planet:    body.planet,
        longitude: planet.longitude,
        sign:      planet.sign,
        dms:       planet.dms,
        nakshatra: getNakshatra(planet.longitude),
      };
    });
    res.json(buildResponse({ input: body, calculationContext: null, data }));
  } catch (err) { next(err); }
}

// ── POST /vedic/dasha/vimshottari ─────────────────────────────────────────────

export async function getVimshottariDasha(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = VimshottariSchema.parse(req.body);
    const cacheKey = `vedic:dasha:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 86400, async () => {
      const chart     = await calcVedicBirthChart(body, body.ayanamsa as AyanamsaName);
      const moon      = chart.chart.planets.find((p) => p.planet === 'Moon');
      if (!moon) throw new Error('Moon not found in chart');
      const birthDate = new Date(`${body.date}T${body.time}`);
      const dasha     = calcVimshottari(moon.longitude, birthDate, body.yearsAhead, body.includePratyantardasha);
      return {
        moonPosition: { longitude: moon.longitude, sign: moon.sign, degree: moon.degreeInSign, dms: moon.dms },
        ayanamsa:     { name: body.ayanamsa, value: chart.ayanamsa },
        ...dasha,
      };
    });
    const utc = birthToUtcMoment(body);
    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay: utc.julianDay,
        utcDateTime: new Date(`${body.date}T${body.time}`).toISOString(),
        mode: 'sidereal',
        ayanamsa: { name: body.ayanamsa, value: (data as { ayanamsa: { value: number } }).ayanamsa.value },
      }),
      data,
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/navamsa ───────────────────────────────────────────────────────

export async function getNavamsa(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = NavamsaSchema.parse(req.body);
    const cacheKey = `vedic:navamsa:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const chart   = await calcVedicBirthChart(body, body.ayanamsa as AyanamsaName);
      const navamsa = calcNavamsa(chart.chart.planets);
      return {
        ayanamsa:       { name: body.ayanamsa, value: chart.ayanamsa },
        natalPlanets:   chart.chart.planets,
        navamsaPlanets: navamsa,
      };
    });
    const utc = birthToUtcMoment(body);
    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay: utc.julianDay,
        utcDateTime: new Date(`${body.date}T${body.time}`).toISOString(),
        mode: 'sidereal',
        ayanamsa: { name: body.ayanamsa, value: (data as { ayanamsa: { value: number } }).ayanamsa.value },
      }),
      data,
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/vargas ────────────────────────────────────────────────────────

export async function getVargas(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = VargasSchema.parse(req.body);
    const cacheKey = `vedic:vargas:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const chart  = await calcVedicBirthChart(body, body.ayanamsa as AyanamsaName);
      const inputs = chart.chart.planets.map((p) => ({ planet: p.planet, longitude: p.longitude }));
      const vargas = calcVargas(inputs, body.vargas as VargaCode[]);
      return {
        ayanamsa:     { name: body.ayanamsa, value: chart.ayanamsa },
        natalPlanets: chart.chart.planets,
        vargas,
      };
    });
    const utc = birthToUtcMoment(body);
    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay: utc.julianDay,
        utcDateTime: new Date(`${body.date}T${body.time}`).toISOString(),
        mode: 'sidereal',
        ayanamsa: { name: body.ayanamsa, value: (data as { ayanamsa: { value: number } }).ayanamsa.value },
      }),
      data,
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/compatibility ─────────────────────────────────────────────────

export async function getCompatibility(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = CompatibilitySchema.parse(req.body);
    const cacheKey = `vedic:compat:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const [chart1, chart2] = await Promise.all([
        calcVedicBirthChart(body.person1, body.ayanamsa as AyanamsaName),
        calcVedicBirthChart(body.person2, body.ayanamsa as AyanamsaName),
      ]);
      const moon1 = chart1.chart.planets.find((p) => p.planet === 'Moon');
      const moon2 = chart2.chart.planets.find((p) => p.planet === 'Moon');
      if (!moon1) throw new Error('Moon not found in person1 chart');
      if (!moon2) throw new Error('Moon not found in person2 chart');
      return calcGunaMilan(moon1.longitude, moon2.longitude);
    });
    res.json(buildResponse({
      input: { person1: body.person1, person2: body.person2, ayanamsa: body.ayanamsa },
      calculationContext: null,
      data,
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/yogas ─────────────────────────────────────────────────────────

export async function getYogas(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = YogasSchema.parse(req.body);
    const cacheKey = `vedic:yogas:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const chart  = await calcVedicBirthChart(body, body.ayanamsa as AyanamsaName, body.houseSystem);
      const report = calcYogasAndDoshas(chart.chart.planets);
      return {
        ayanamsa: { name: body.ayanamsa, value: chart.ayanamsa },
        ...report,
      };
    });
    const utc = birthToUtcMoment(body);
    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay: utc.julianDay,
        utcDateTime: new Date(`${body.date}T${body.time}`).toISOString(),
        mode: 'sidereal',
        ayanamsa: { name: body.ayanamsa, value: (data as { ayanamsa: { value: number } }).ayanamsa.value },
        houseSystem: body.houseSystem,
      }),
      data,
    }));
  } catch (err) { next(err); }
}

// ── POST /vedic/horoscope ─────────────────────────────────────────────────────

export async function getHoroscope(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = HoroscopeSchema.parse(req.body);
    const cacheKey = `vedic:horoscope:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, body.period === 'yearly' ? 86400 : 3600, async () => {
      const chart = await calcVedicBirthChart(body, body.ayanamsa as AyanamsaName, body.houseSystem);
      const ascSignIdx = Math.floor(chart.chart.houses.ascendant / 30);
      return calcHoroscope({
        natalPlanets:    chart.chart.planets,
        natalAscSignIdx: ascSignIdx,
        lat:             body.transitLatitude  ?? body.latitude,
        lon:             body.transitLongitude ?? body.longitude,
        timezone:        body.transitTimezone  ?? body.timezone,
        ayanamsa:        body.ayanamsa as AyanamsaName,
        period:          body.period as HoroscopePeriod,
        startDate:       body.startDate,
      });
    });
    res.json(buildResponse({ input: body, calculationContext: null, data }));
  } catch (err) { next(err); }
}

// ── POST /vedic/kundali ───────────────────────────────────────────────────────

export async function getKundali(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body     = KundaliSchema.parse(req.body);
    const cacheKey = `vedic:kundali:${JSON.stringify(body)}`;
    const data     = await getOrSet(cacheKey, 3600, () =>
      calcKundali({
        natal:                  body,
        ayanamsa:               body.ayanamsa as AyanamsaName,
        houseSystem:            body.houseSystem,
        includePratyantardasha: body.includePratyantardasha,
        partner:                body.partner,
        transitDate:            body.transitDate,
        transitLat:             body.transitLatitude,
        transitLon:             body.transitLongitude,
        transitTimezone:        body.transitTimezone,
      })
    );
    res.json(buildResponse({ input: body, calculationContext: null, data }));
  } catch (err) { next(err); }
}

// ── POST /vedic/kundali/export/excel ─────────────────────────────────────────

export async function exportKundaliExcel(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body  = KundaliSchema.parse(req.body);
    const label = `Kundali_${body.date}_${body.latitude}_${body.longitude}`;

    const data = await calcKundali({
      natal:                  body,
      ayanamsa:               body.ayanamsa as AyanamsaName,
      houseSystem:            body.houseSystem,
      includePratyantardasha: body.includePratyantardasha,
      partner:                body.partner,
      transitDate:            body.transitDate,
    });

    const wb = await generateKundaliExcel(data as unknown as Record<string, unknown>, label);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${label}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}
