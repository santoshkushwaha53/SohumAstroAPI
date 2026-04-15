import type { Request, Response, NextFunction } from 'express';
import {
  JulianDaySchema,
  PlanetPositionsSchema,
  HousesSchema,
  PLANET_NAMES,
} from '../validators/astro.validator';
import { birthToUtcMoment } from '../../modules/astronomy/julian';
import { ephemerisService } from '../../modules/astronomy/ephemeris.service';
import type { AyanamsaName } from '../../modules/astronomy/types';
import { getOrSet } from '../../cache/redis.client';

// ── GET /astro/meta ───────────────────────────────────────────────────────────

export function getAstroMeta(_req: Request, res: Response): void {
  res.json({
    success: true,
    data: {
      planets: [...PLANET_NAMES],
      houseSystems: {
        P: 'Placidus',
        W: 'Whole Sign',
        E: 'Equal',
        K: 'Koch',
        O: 'Porphyry',
        R: 'Regiomontanus',
        C: 'Campanus',
      },
      ayanamsas: {
        LAHIRI:        'Lahiri (Indian national standard)',
        RAMAN:         'B.V. Raman',
        KRISHNAMURTI:  'Krishnamurti (KP system)',
        FAGAN_BRADLEY: 'Fagan/Bradley (Western sidereal)',
        TRUE_CITRA:    'True Chitrapaksha',
      },
      modes: ['tropical', 'sidereal'],
      version: '1.0.0',
    },
  });
}

// ── POST /astro/julian-day ────────────────────────────────────────────────────

export function getJulianDay(req: Request, res: Response, next: NextFunction): void {
  try {
    const body = JulianDaySchema.parse(req.body);
    const utc = birthToUtcMoment({
      date: body.date, time: body.time, timezone: body.timezone,
      latitude: 0, longitude: 0,
    });
    res.json({
      success: true,
      data: {
        input:       { date: body.date, time: body.time, timezone: body.timezone },
        utc:         { year: utc.year, month: utc.month, day: utc.day, hour: Number(utc.hour.toFixed(6)) },
        julianDay:   utc.julianDay,
        julianDayUT: utc.julianDay,
        note: 'julianDay is Julian Day Number in Universal Time (UT1 ≈ UTC)',
      },
    });
  } catch (err) { next(err); }
}

// ── POST /astro/planet-positions ──────────────────────────────────────────────

export async function getPlanetPositions(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = PlanetPositionsSchema.parse(req.body);
    const cacheKey = `astro:planets:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const utc = birthToUtcMoment({
        date: body.date, time: body.time, timezone: body.timezone,
        latitude: 0, longitude: 0,
      });
      const planets = await ephemerisService.calcPlanets(
        utc.julianDay, body.mode, body.ayanamsa as AyanamsaName, body.planets
      );
      return {
        input:     body,
        julianDay: utc.julianDay,
        utc:       { year: utc.year, month: utc.month, day: utc.day, hour: utc.hour },
        mode:      body.mode,
        ayanamsa:  body.mode === 'sidereal'
          ? { name: body.ayanamsa, value: ephemerisService.getAyanamsa(utc.julianDay, body.ayanamsa as AyanamsaName) }
          : null,
        planets,
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── POST /astro/houses ────────────────────────────────────────────────────────

export async function getHouses(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = HousesSchema.parse(req.body);
    const cacheKey = `astro:houses:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const utc = birthToUtcMoment({
        date: body.date, time: body.time, timezone: body.timezone,
        latitude: body.latitude, longitude: body.longitude,
      });
      const geo = { latitude: body.latitude, longitude: body.longitude };
      const houses = await ephemerisService.calcHouses(
        utc.julianDay, geo, body.houseSystem, body.mode, body.ayanamsa as AyanamsaName
      );
      return {
        input:     body,
        julianDay: utc.julianDay,
        mode:      body.mode,
        ayanamsa:  body.mode === 'sidereal'
          ? { name: body.ayanamsa, value: ephemerisService.getAyanamsa(utc.julianDay, body.ayanamsa as AyanamsaName) }
          : null,
        houses,
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
