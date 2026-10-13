import { Router } from 'express';
import { equipmentController } from '../controllers/equipment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { idParamSchema } from '../validators/common.validator';
import {
  controlEquipmentSchema,
  createEquipmentSchema,
  listEquipmentQuery,
  updateEquipmentSchema,
} from '../validators/equipment.validator';

export const equipmentRouter = Router();

equipmentRouter.use(authenticate);
equipmentRouter.post('/', validate({ body: createEquipmentSchema }), equipmentController.create);
equipmentRouter.post(
  '/control',
  validate({ body: controlEquipmentSchema }),
  equipmentController.control,
);
equipmentRouter.get('/', validate({ query: listEquipmentQuery }), equipmentController.list);
equipmentRouter.get('/:id/status', validate({ params: idParamSchema }), equipmentController.status);
equipmentRouter.post('/:id/on', validate({ params: idParamSchema }), equipmentController.turnOn);
equipmentRouter.post('/:id/off', validate({ params: idParamSchema }), equipmentController.turnOff);
equipmentRouter.get('/:id', validate({ params: idParamSchema }), equipmentController.get);
equipmentRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateEquipmentSchema }),
  equipmentController.update,
);
