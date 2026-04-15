import { Router } from 'express';
import { generateReport, getReportStatus } from '../controllers/reports.controller';
import { apiKeyAuth } from '../middlewares/auth.middleware';
import { defaultRateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @openapi
 * /reports/generate:
 *   post:
 *     tags: [Reports]
 *     summary: Queue an async report generation job
 *     description: |
 *       Enqueues a BullMQ job to generate a chart report.
 *       Returns a jobId immediately (HTTP 202). Poll `/reports/{jobId}` for status.
 *       Supported reportTypes: vedic-birth-chart, western-birth-chart,
 *       vimshottari-dasha, navamsa, synastry, transit-report.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportType, userId, natal]
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [vedic-birth-chart, western-birth-chart, vimshottari-dasha, navamsa, synastry, transit-report]
 *                 example: vedic-birth-chart
 *               userId:
 *                 type: string
 *                 example: user_abc123
 *               natal:
 *                 $ref: '#/components/schemas/BirthInput'
 *               natal2:
 *                 $ref: '#/components/schemas/BirthInput'
 *               transitDate:
 *                 type: string
 *                 example: "2024-06-15"
 *               options:
 *                 type: object
 *                 properties:
 *                   ayanamsa:    { type: string, example: LAHIRI }
 *                   houseSystem: { type: string, example: W }
 *                   yearsAhead:  { type: integer, example: 100 }
 *     responses:
 *       202:
 *         description: Job queued — returns jobId and statusUrl
 */
router.post('/generate', apiKeyAuth, defaultRateLimit, generateReport);

/**
 * @openapi
 * /reports/{jobId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get the status and result of a queued report job
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *         example: "1"
 *     responses:
 *       200:
 *         description: Job status (queued/active/completed/failed) with result if complete
 *       404:
 *         description: Job not found
 */
router.get('/:jobId', apiKeyAuth, getReportStatus);

export default router;
