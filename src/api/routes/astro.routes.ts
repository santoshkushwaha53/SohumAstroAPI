import { Router } from 'express';
import {
  getAstroMeta,
  getJulianDay,
  getPlanetPositions,
  getHouses,
} from '../controllers/astro.controller';
import { apiKeyAuth } from '../middlewares/auth.middleware';
import { astroRateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @openapi
 * /astro/meta:
 *   get:
 *     tags: [Astronomy]
 *     summary: List supported planets, house systems, ayanamsas, and modes
 *     security: []
 *     responses:
 *       200:
 *         description: Metadata for all supported options
 */
router.get('/meta', getAstroMeta);

/**
 * @openapi
 * /astro/julian-day:
 *   post:
 *     tags: [Astronomy]
 *     summary: Convert a calendar date/time to Julian Day Number
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:     { type: string, example: "1988-08-01" }
 *               time:     { type: string, example: "12:00:00" }
 *               timezone: { type: string, example: "+05:30" }
 *     responses:
 *       200:
 *         description: Julian Day with UTC breakdown
 */
router.post('/julian-day', apiKeyAuth, getJulianDay);

/**
 * @openapi
 * /astro/planet-positions:
 *   post:
 *     tags: [Astronomy]
 *     summary: Calculate planetary positions for a date/time (tropical or sidereal)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:     { type: string, example: "1988-08-01" }
 *               time:     { type: string, example: "12:00:00" }
 *               timezone: { type: string, example: "+05:30" }
 *               mode:     { type: string, enum: [tropical, sidereal], example: "sidereal" }
 *               ayanamsa: { type: string, enum: [LAHIRI, RAMAN, KRISHNAMURTI, FAGAN_BRADLEY, TRUE_CITRA], example: "LAHIRI" }
 *               planets:  { type: array, items: { type: string }, example: ["Sun","Moon","Mars"] }
 *     responses:
 *       200:
 *         description: Planetary positions with sign, degree, speed, retrograde status
 */
router.post('/planet-positions', apiKeyAuth, astroRateLimit, getPlanetPositions);

/**
 * @openapi
 * /astro/houses:
 *   post:
 *     tags: [Astronomy]
 *     summary: Calculate house cusps for a date, time, and geographic location
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, latitude, longitude]
 *             properties:
 *               date:        { type: string, example: "1988-08-01" }
 *               time:        { type: string, example: "12:00:00" }
 *               timezone:    { type: string, example: "+05:30" }
 *               latitude:    { type: number, example: 25.4358 }
 *               longitude:   { type: number, example: 81.8463 }
 *               houseSystem: { type: string, enum: [P, W, E, K, O, R, C], example: "P" }
 *               mode:        { type: string, enum: [tropical, sidereal], example: "tropical" }
 *               ayanamsa:    { type: string, example: "LAHIRI" }
 *     responses:
 *       200:
 *         description: House cusps 1-12 with ascendant, MC, and vertex
 */
router.post('/houses', apiKeyAuth, astroRateLimit, getHouses);

export default router;
