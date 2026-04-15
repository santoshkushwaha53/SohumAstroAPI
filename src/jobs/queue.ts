import { Queue, Worker, type Job } from 'bullmq';
import { logger } from '../config/logger';
import { config } from '../config';
import { reportProcessor } from './processors/report.processor';

// BullMQ needs its own Redis connection with maxRetriesPerRequest: null
// (required for blocking commands); do NOT share the app-level ioredis client.
function parseBullConnection() {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: config.REDIS_PASSWORD || url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

// ── Queue Definitions ─────────────────────────────────────────────────────────

export const reportQueue = new Queue('report-jobs', {
  connection: parseBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// ── Worker ────────────────────────────────────────────────────────────────────

export function startWorkers(): void {
  const worker = new Worker(
    'report-jobs',
    async (job: Job) => {
      logger.info({ jobId: job.id, jobName: job.name }, 'Processing job');
      return reportProcessor(job);
    },
    {
      connection: parseBullConnection(),
      concurrency: config.BULL_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job failed');
  });

  logger.info('BullMQ workers started');
}

// ── Job helpers ───────────────────────────────────────────────────────────────

export async function enqueueReport(payload: Record<string, unknown>): Promise<string> {
  const job = await reportQueue.add('generate-report', payload);
  return job.id ?? 'unknown';
}
