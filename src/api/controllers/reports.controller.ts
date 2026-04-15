import type { Request, Response, NextFunction } from 'express';
import { GenerateReportSchema } from '../validators/reports.validator';
import { enqueueReport } from '../../jobs/queue';
import { AppError } from '../middlewares/error.middleware';

// ── POST /reports/generate ────────────────────────────────────────────────────

export async function generateReport(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const body = GenerateReportSchema.parse(req.body);
    const jobId = await enqueueReport({
      userId:     body.userId,
      reportType: body.reportType,
      natal:      body.natal,
      natal2:     body.natal2,
      transitDate: body.transitDate,
      transitTimezone: body.transitTimezone,
      options:    body.options ?? {},
    });

    res.status(202).json({
      success: true,
      data: {
        jobId,
        status:    'queued',
        reportType: body.reportType,
        queuedAt:   new Date().toISOString(),
        statusUrl:  `/api/v1/reports/${jobId}`,
        message:    'Report generation queued. Poll statusUrl for completion.',
      },
    });
  } catch (err) { next(err); }
}

// ── GET /reports/:jobId ───────────────────────────────────────────────────────

export async function getReportStatus(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!jobId) return next(new AppError(400, 'jobId is required'));

    // Import queue here to avoid circular dep issues at startup
    const { reportQueue } = await import('../../jobs/queue');
    const job = await reportQueue.getJob(jobId);

    if (!job) return next(new AppError(404, `Job ${jobId} not found`));

    const state  = await job.getState();
    const progress = job.progress;

    res.json({
      success: true,
      data: {
        jobId,
        status:     state,
        progress:   typeof progress === 'number' ? progress : 0,
        queuedAt:   new Date(job.timestamp).toISOString(),
        startedAt:  job.processedOn ? new Date(job.processedOn).toISOString() : null,
        completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        result:     state === 'completed' ? job.returnvalue : null,
        error:      state === 'failed' ? job.failedReason : null,
      },
    });
  } catch (err) { next(err); }
}
