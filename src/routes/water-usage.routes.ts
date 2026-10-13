import { Router } from 'express';
import { waterUsageController } from '../controllers/water-usage.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createWaterUsageSchema,
  waterDailyQuery,
  waterHistoryQuery,
  waterMonthlyQuery,
  waterStatisticsQuery,
  waterTotalQuery,
} from '../validators/water-usage.validator';

export const waterUsageRouter = Router();

waterUsageRouter.use(authenticate);
waterUsageRouter.post('/', validate({ body: createWaterUsageSchema }), waterUsageController.create);
waterUsageRouter.get('/daily', validate({ query: waterDailyQuery }), waterUsageController.daily);
waterUsageRouter.get(
  '/monthly',
  validate({ query: waterMonthlyQuery }),
  waterUsageController.monthly,
);
waterUsageRouter.get('/total', validate({ query: waterTotalQuery }), waterUsageController.total);
waterUsageRouter.get(
  '/statistics',
  validate({ query: waterStatisticsQuery }),
  waterUsageController.statistics,
);
waterUsageRouter.get('/', validate({ query: waterHistoryQuery }), waterUsageController.history);
