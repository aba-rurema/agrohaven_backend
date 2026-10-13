import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  activationSchema,
  adminCreateUserSchema,
  adminRangeQuery,
  adminUserListQuery,
} from '../validators/admin.validator';
import { listAlertsQuery } from '../validators/alert.validator';
import { idParamSchema } from '../validators/common.validator';
import { listDevicesQuery } from '../validators/device.validator';
import { listFarmingUnitsQuery } from '../validators/farming-unit.validator';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.get('/users', validate({ query: adminUserListQuery }), adminController.listUsers);
adminRouter.post('/users', validate({ body: adminCreateUserSchema }), adminController.createUser);
adminRouter.patch(
  '/users/:id/activation',
  validate({ params: idParamSchema, body: activationSchema }),
  adminController.setActivation,
);
adminRouter.get(
  '/farming-units',
  validate({ query: listFarmingUnitsQuery }),
  adminController.listFarmingUnits,
);
adminRouter.get('/devices', validate({ query: listDevicesQuery }), adminController.listDevices);
adminRouter.get('/alerts', validate({ query: listAlertsQuery }), adminController.listAlerts);
adminRouter.get(
  '/sensors/statistics',
  validate({ query: adminRangeQuery }),
  adminController.sensorStatistics,
);
adminRouter.get('/statistics', adminController.statistics);
