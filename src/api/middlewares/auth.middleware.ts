import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { AppError } from './error.middleware';

/**
 * Simple API-key authentication.
 * Production: hash + DB lookup via PrismaClient.
 * Dev: compare to MASTER_API_KEY.
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const key = req.headers[config.API_KEY_HEADER] as string | undefined;

  if (!key) {
    return next(new AppError(401, 'API key required'));
  }

  // Dev shortcut — replace with DB lookup in production
  if (config.MASTER_API_KEY && key === config.MASTER_API_KEY) {
    return next();
  }

  // TODO: hash `key` with SHA-256 and look up in api_keys table
  return next(new AppError(401, 'Invalid or expired API key'));
}

/** Optional auth — attaches user if key present, passes if not */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const key = req.headers[config.API_KEY_HEADER] as string | undefined;
  if (!key) return next();
  apiKeyAuth(req, _res, next);
}
