import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../config/logger';

export const redisClient = new Redis(config.REDIS_URL, {
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
redisClient.on('reconnecting', () => logger.warn('Redis reconnecting'));

export async function connectRedis(): Promise<void> {
  // BullMQ may have already connected the shared client — skip if ready
  if (redisClient.status === 'ready' || redisClient.status === 'connecting') return;
  await redisClient.connect();
}

/**
 * Cache-aside helper.
 * Returns cached value if present, otherwise calls `fn`, caches, and returns.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fn: () => T | Promise<T>
): Promise<T> {
  const cached = await redisClient.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  const value = await fn();
  await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}

/** Invalidate a cache key */
export async function invalidate(key: string): Promise<void> {
  await redisClient.del(key);
}

/** Invalidate all keys matching a pattern (use sparingly) */
export async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await redisClient.keys(pattern);
  if (keys.length) await redisClient.del(...keys);
}
