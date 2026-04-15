import type { Request, Response, NextFunction } from 'express';
import { TransitSchema } from '../validators/western.validator';
import { calcTransits } from '../../modules/western/transit.service';
import { getOrSet } from '../../cache/redis.client';

export async function getTransits(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = TransitSchema.parse(req.body);
    const cacheKey = `transits:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 1800, async () => {
      const result = await calcTransits(
        body.natal, body.transitDate, body.transitTime, body.transitTimezone
      );
      return {
        input:         body,
        transitDate:   body.transitDate,
        natalPlanets:  result.natalPlanets,
        transitPlanets: result.transitPlanets,
        transitAspects: result.transitAspects,
        totalAspects:  result.transitAspects.length,
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
