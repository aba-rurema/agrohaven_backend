import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { dashboardQuery } from '../validators/admin.validator';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  authenticate,
  validate({ query: dashboardQuery }),
  dashboardController.get,
);
