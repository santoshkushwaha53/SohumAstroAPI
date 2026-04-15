import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Service health check
 *     security: []
 *     responses:
 *       200:
 *         description: All services healthy
 *       503:
 *         description: One or more services degraded
 */
router.get('/', healthCheck);

export default router;
