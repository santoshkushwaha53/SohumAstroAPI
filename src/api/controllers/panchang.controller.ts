import type { Request, Response, NextFunction } from 'express';
import { PanchangSchema, PanchangRangeSchema } from '../validators/panchang.validator';
import { calcPanchang } from '../../modules/panchang/panchang.service';
import { generatePanchangExcel } from '../../modules/export/excel.service';
import { getOrSet } from '../../cache/redis.client';
import type { AyanamsaName } from '../../modules/astronomy/types';
import { buildResponse, buildCalcContext } from '../utils/response';
import * as swe from 'swisseph';

// ── POST /panchang ────────────────────────────────────────────────────────────

export async function getPanchang(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body     = PanchangSchema.parse(req.body);
    const cacheKey = `panchang:${JSON.stringify(body)}`;
    const data = await getOrSet(cacheKey, 3600, () =>
      calcPanchang(body.date, body.latitude, body.longitude, body.timezone, body.ayanamsa as AyanamsaName)
    );

    const [year, month, day] = body.date.split('-').map(Number);
    const jd = swe.swe_julday(year!, month!, day!, 0, swe.SE_GREG_CAL);

    res.json(buildResponse({
      input: body,
      calculationContext: buildCalcContext({
        julianDay:   jd,
        utcDateTime: `${body.date}T00:00:00Z`,
        mode:        'sidereal',
        ayanamsa:    { name: body.ayanamsa, value: 0 },
        houseSystem: null,
      }),
      data,
    }));
  } catch (err) { next(err); }
}

// ── POST /panchang/range ──────────────────────────────────────────────────────

export async function getPanchangRange(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = PanchangRangeSchema.parse(req.body);

    const rows: Awaited<ReturnType<typeof calcPanchang>>[] = [];
    const start = new Date(`${body.startDate}T00:00:00Z`);

    for (let i = 0; i < body.days; i++) {
      const d    = new Date(start.getTime() + i * 86400000);
      const date = d.toISOString().slice(0, 10);
      const cacheKey = `panchang:${date}:${body.latitude}:${body.longitude}:${body.timezone}:${body.ayanamsa}`;
      const row  = await getOrSet(cacheKey, 86400, () =>
        calcPanchang(date, body.latitude, body.longitude, body.timezone, body.ayanamsa as AyanamsaName)
      );
      rows.push(row);
    }

    // Excel export
    if (body.exportExcel) {
      const dateRange = `${body.startDate}_${body.days}d`;
      const wb = await generatePanchangExcel(rows, dateRange);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Panchang_${dateRange}.xlsx"`);
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    res.json(buildResponse({
      input: body,
      calculationContext: null,
      data: {
        startDate: body.startDate,
        days:      body.days,
        count:     rows.length,
        rows,
      },
    }));
  } catch (err) { next(err); }
}
