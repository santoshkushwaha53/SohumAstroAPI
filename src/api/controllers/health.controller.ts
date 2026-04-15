import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.client';
import { redisClient } from '../../cache/redis.client';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redisClient.ping(),
  ]);

  const db = checks[0].status === 'fulfilled' ? 'ok' : 'error';
  const redis = checks[1].status === 'fulfilled' ? 'ok' : 'error';
  const healthy = db === 'ok' && redis === 'ok';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { db, redis },
    version: process.env['npm_package_version'] ?? '1.0.0',
  });
}
