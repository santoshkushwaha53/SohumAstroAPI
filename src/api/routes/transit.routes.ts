import { Router } from 'express';
import { getTransits } from '../controllers/transit.controller';
import { apiKeyAuth } from '../middlewares/auth.middleware';
import { astroRateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @openapi
 * /transits:
 *   post:
 *     tags: [Western]
 *     summary: Current sky vs natal chart — transit aspects
 *     description: |
 *       Compares the planetary positions at `transitDate` against a natal chart.
 *       Aspects are prefixed: T=transit planet, N=natal planet.
 *       Useful for timing events and predictive work.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [natal, transitDate]
 *             properties:
 *               natal:
 *                 $ref: '#/components/schemas/BirthInput'
 *               transitDate:
 *                 type: string
 *                 example: "2024-06-15"
 *               transitTime:
 *                 type: string
 *                 example: "12:00:00"
 *               transitTimezone:
 *                 type: string
 *                 example: "+00:00"
 *               planets:
 *                 type: array
 *                 items: { type: string }
 *                 description: Limit planets computed (default all)
 *     responses:
 *       200:
 *         description: Transit aspects to natal chart
 */
router.post('/', apiKeyAuth, astroRateLimit, getTransits);

export default router;
