import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectDB, disconnectDB } from './db/prisma.client';
import { connectRedis, redisClient } from './cache/redis.client';
import { startWorkers } from './jobs/queue';

async function bootstrap(): Promise<void> {
  // Infra connections
  await connectDB();
  await connectRedis();

  // Start background workers
  startWorkers();

  // Start HTTP server
  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV, prefix: config.API_PREFIX },
      'SohumAstroAPI started'
    );
    logger.info(`Swagger docs → http://localhost:${config.PORT}/docs`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      await disconnectDB();
      await redisClient.quit();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force exit after 10 s
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
