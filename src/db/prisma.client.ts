import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { config } from '../config';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

if (config.NODE_ENV === 'development') {
  (prisma as PrismaClient).$on('query' as never, (e: unknown) => {
    const event = e as { query: string; duration: number };
    logger.debug({ query: event.query, duration: event.duration }, 'Prisma query');
  });
}

(prisma as PrismaClient).$on('error' as never, (e: unknown) => {
  logger.error({ err: e }, 'Prisma error');
});

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected via Prisma');
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
}
