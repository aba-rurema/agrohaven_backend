import { Router } from 'express';
import { farmingUnitController } from '../controllers/farming-unit.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { idParamSchema } from '../validators/common.validator';
import {
  assignFarmingUnitSchema,
  createFarmingUnitSchema,
  farmingUnitStatusSchema,
  listFarmingUnitsQuery,
  updateFarmingUnitSchema,
} from '../validators/farming-unit.validator';

export const farmingUnitRouter = Router();

farmingUnitRouter.use(authenticate);
farmingUnitRouter.post(
  '/',
  validate({ body: createFarmingUnitSchema }),
  farmingUnitController.create,
);
farmingUnitRouter.get('/', validate({ query: listFarmingUnitsQuery }), farmingUnitController.list);
farmingUnitRouter.get(
  '/:id/overview',
  validate({ params: idParamSchema }),
  farmingUnitController.overview,
);
farmingUnitRouter.get('/:id', validate({ params: idParamSchema }), farmingUnitController.get);
farmingUnitRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateFarmingUnitSchema }),
  farmingUnitController.update,
);
farmingUnitRouter.delete('/:id', validate({ params: idParamSchema }), farmingUnitController.remove);
farmingUnitRouter.patch(
  '/:id/assign',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: assignFarmingUnitSchema }),
  farmingUnitController.assign,
);
farmingUnitRouter.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: farmingUnitStatusSchema }),
  farmingUnitController.changeStatus,
);
