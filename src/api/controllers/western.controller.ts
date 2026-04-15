import type { Request, Response, NextFunction } from 'express';
import {
  WesternBirthChartSchema,
  AspectsSchema,
  SynastrySchema,
} from '../validators/western.validator';
import { birthToUtcMoment } from '../../modules/astronomy/julian';
import { ephemerisService } from '../../modules/astronomy/ephemeris.service';
import { calcWesternBirthChart } from '../../modules/western/birth-chart.service';
import { calcAspects } from '../../modules/western/aspects.service';
import { calcSynastry } from '../../modules/western/synastry.service';
import { getOrSet } from '../../cache/redis.client';

// ── POST /western/birth-chart ─────────────────────────────────────────────────

export async function getWesternBirthChart(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = WesternBirthChartSchema.parse(req.body);
    const cacheKey = `western:chart:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, () =>
      calcWesternBirthChart(body, body.houseSystem)
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── POST /western/aspects ─────────────────────────────────────────────────────

export async function getAspects(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = AspectsSchema.parse(req.body);
    const cacheKey = `western:aspects:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, async () => {
      const utc = birthToUtcMoment({
        date: body.date, time: body.time, timezone: body.timezone,
        latitude: 0, longitude: 0,
      });
      const planets = await ephemerisService.calcPlanets(
        utc.julianDay, 'tropical', 'LAHIRI', body.planets
      );
      const aspects = calcAspects(
        planets.map((p) => ({ planet: p.planet, longitude: p.longitude, speed: p.speed })),
        body.orbs
      );
      return {
        input:   body,
        julianDay: utc.julianDay,
        planets,
        aspects,
        totalAspects: aspects.length,
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── POST /western/synastry ────────────────────────────────────────────────────

export async function getSynastry(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = SynastrySchema.parse(req.body);
    const cacheKey = `western:synastry:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, () =>
      calcSynastry(body.person1, body.person2)
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
