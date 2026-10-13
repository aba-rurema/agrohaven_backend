import { Router } from 'express';
import { deviceController } from '../controllers/device.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authenticateDevice } from '../middleware/device-auth.middleware';
import { ingestRateLimit } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import { commandIdParamSchema, idParamSchema } from '../validators/common.validator';
import {
  acknowledgeCommandSchema,
  heartbeatSchema,
  listDevicesQuery,
  registerDeviceSchema,
  updateDeviceSchema,
} from '../validators/device.validator';
import { deviceTelemetrySchema } from '../validators/sensor.validator';

export const deviceRouter = Router();

deviceRouter.post(
  '/telemetry',
  ingestRateLimit,
  authenticateDevice,
  validate({ body: deviceTelemetrySchema }),
  deviceController.telemetry,
);
deviceRouter.post(
  '/heartbeat',
  authenticateDevice,
  validate({ body: heartbeatSchema }),
  deviceController.heartbeat,
);
deviceRouter.get('/commands', authenticateDevice, deviceController.commands);
deviceRouter.post(
  '/commands/:commandId/ack',
  authenticateDevice,
  validate({ params: commandIdParamSchema, body: acknowledgeCommandSchema }),
  deviceController.acknowledge,
);

deviceRouter.use(authenticate);
deviceRouter.post('/register', validate({ body: registerDeviceSchema }), deviceController.register);
deviceRouter.get('/', validate({ query: listDevicesQuery }), deviceController.list);
deviceRouter.post(
  '/:id/rotate-key',
  validate({ params: idParamSchema }),
  deviceController.rotateKey,
);
deviceRouter.get('/:id', validate({ params: idParamSchema }), deviceController.get);
deviceRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateDeviceSchema }),
  deviceController.update,
);
