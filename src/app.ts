import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { config } from './config';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import { defaultRateLimit } from './api/middlewares/rate-limit.middleware';
import { errorMiddleware } from './api/middlewares/error.middleware';
import apiRouter from './api/routes/index';

export function createApp(): express.Application {
  const app = express();

  // ── Security & parsing ──────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── HTTP request logging ───────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      customLogLevel(_req, res) {
        return res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      },
    })
  );

  // ── Rate limiting (global) ─────────────────────────────────────────────────
  app.use(defaultRateLimit);

  // ── API docs ───────────────────────────────────────────────────────────────
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { customSiteTitle: 'SohumAstroAPI Docs' })
  );
  app.get('/openapi.json', (_req, res) => res.json(swaggerSpec));

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use(config.API_PREFIX, apiRouter);

  // ── 404 ────────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // ── Error handler ──────────────────────────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
