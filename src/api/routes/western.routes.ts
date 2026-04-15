import { Router } from 'express';
import {
  getWesternBirthChart,
  getAspects,
  getSynastry,
} from '../controllers/western.controller';
import { apiKeyAuth } from '../middlewares/auth.middleware';
import { astroRateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @openapi
 * /western/birth-chart:
 *   post:
 *     tags: [Western]
 *     summary: Full Western tropical birth chart with Placidus houses and aspects
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   houseSystem: { type: string, enum: [P, W, E, K, O, R, C], example: "P" }
 *     responses:
 *       200:
 *         description: Tropical chart with planets, Placidus houses, and all aspects
 */
router.post('/birth-chart', apiKeyAuth, astroRateLimit, getWesternBirthChart);

/**
 * @openapi
 * /western/aspects:
 *   post:
 *     tags: [Western]
 *     summary: Calculate aspects between planets for a given date/time
 *     description: Returns all major and minor aspects with orb. Custom orbs can override defaults.
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
 *               planets:  { type: array, items: { type: string }, example: ["Sun","Moon","Mars","Saturn"] }
 *               orbs:
 *                 type: object
 *                 description: Custom orb overrides per aspect name
 *                 example: { Conjunction: 10, Trine: 6 }
 *     responses:
 *       200:
 *         description: Aspect list sorted by orb (tightest first)
 */
router.post('/aspects', apiKeyAuth, astroRateLimit, getAspects);

/**
 * @openapi
 * /western/synastry:
 *   post:
 *     tags: [Western]
 *     summary: Cross-aspects between two natal charts (relationship compatibility)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [person1, person2]
 *             properties:
 *               person1:
 *                 allOf:
 *                   - $ref: '#/components/schemas/BirthInput'
 *                   - type: object
 *                     properties: { label: { type: string, example: "Alice" } }
 *               person2:
 *                 allOf:
 *                   - $ref: '#/components/schemas/BirthInput'
 *                   - type: object
 *                     properties: { label: { type: string, example: "Bob" } }
 *     responses:
 *       200:
 *         description: Cross-aspects sorted by orb
 */
router.post('/synastry', apiKeyAuth, astroRateLimit, getSynastry);

export default router;
