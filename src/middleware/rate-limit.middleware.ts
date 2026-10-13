import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { errorBody } from '../utils/api-error';

function buildLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json(errorBody('Too many requests. Try again later.', 'RATE_LIMITED'));
    },
  });
}

export const apiRateLimit = buildLimiter(300);
export const authRateLimit = buildLimiter(20);
export const ingestRateLimit = buildLimiter(2000);
