import { Router } from 'express';
import { sensorController } from '../controllers/sensor.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authenticateUserOrDevice } from '../middleware/device-auth.middleware';
import { ingestRateLimit } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createReadingSchema,
  dailyStatQuery,
  latestReadingQuery,
  monthlyStatQuery,
  sensorHistoryQuery,
} from '../validators/sensor.validator';

export const sensorRouter = Router();

sensorRouter.get('/metrics', authenticate, sensorController.metrics);
sensorRouter.post(
  '/readings',
  ingestRateLimit,
  authenticateUserOrDevice,
  validate({ body: createReadingSchema }),
  sensorController.create,
);
sensorRouter.get(
  '/readings/latest',
  authenticate,
  validate({ query: latestReadingQuery }),
  sensorController.latest,
);
sensorRouter.get(
  '/readings',
  authenticate,
  validate({ query: sensorHistoryQuery }),
  sensorController.history,
);
sensorRouter.get(
  '/statistics/daily',
  authenticate,
  validate({ query: dailyStatQuery }),
  sensorController.daily,
);
sensorRouter.get(
  '/statistics/weekly',
  authenticate,
  validate({ query: dailyStatQuery }),
  sensorController.weekly,
);
sensorRouter.get(
  '/statistics/monthly',
  authenticate,
  validate({ query: monthlyStatQuery }),
  sensorController.monthly,
);
