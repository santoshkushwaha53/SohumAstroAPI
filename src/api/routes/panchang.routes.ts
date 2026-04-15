import { Router } from 'express';
import { getPanchang, getPanchangRange } from '../controllers/panchang.controller';
import { apiKeyAuth } from '../middlewares/auth.middleware';
import { astroRateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @openapi
 * /panchang:
 *   post:
 *     tags: [Panchang]
 *     summary: Daily Panchang — all 5 limbs + auspicious periods
 *     description: |
 *       Returns Tithi, Nakshatra, Yoga, Karana, Vara, Rahu Kaal, Gulika, Yamaganda,
 *       Abhijit Muhurat, 24 Horas, and 16 Choghadiyas. All times UTC + local.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, latitude, longitude, timezone]
 *             properties:
 *               date:      { type: string, example: "2026-04-15" }
 *               timezone:  { type: string, example: "+05:30" }
 *               latitude:  { type: number, example: 25.4358 }
 *               longitude: { type: number, example: 81.8463 }
 *               ayanamsa:  { type: string, example: "LAHIRI" }
 *     responses:
 *       200:
 *         description: Full panchang raw data
 */
router.post('/', apiKeyAuth, astroRateLimit, getPanchang);

/**
 * @openapi
 * /panchang/range:
 *   post:
 *     tags: [Panchang]
 *     summary: Panchang for a date range — auspicious times calendar
 *     description: |
 *       Returns per-day Panchang for up to 365 days from startDate.
 *       Set exportExcel=true to download a formatted .xlsx file.
 *       Use this for daily/weekly/monthly auspicious times calendars.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startDate, latitude, longitude, timezone]
 *             properties:
 *               startDate:   { type: string, example: "2026-04-15" }
 *               days:        { type: integer, minimum: 1, maximum: 365, default: 7 }
 *               timezone:    { type: string, example: "+05:30" }
 *               latitude:    { type: number, example: 25.4358 }
 *               longitude:   { type: number, example: 81.8463 }
 *               ayanamsa:    { type: string, example: "LAHIRI" }
 *               exportExcel: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Array of daily panchang rows (or Excel file if exportExcel=true)
 */
router.post('/range', apiKeyAuth, astroRateLimit, getPanchangRange);

export default router;
