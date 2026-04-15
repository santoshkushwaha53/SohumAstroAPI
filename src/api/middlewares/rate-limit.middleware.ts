import rateLimit from 'express-rate-limit';
import { config } from '../../config';

export const defaultRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests — please slow down',
  },
});

/** Stricter limit for compute-heavy astro endpoints */
export const astroRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: Math.floor(config.RATE_LIMIT_MAX / 2),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit reached for astrology computation endpoints',
  },
});
