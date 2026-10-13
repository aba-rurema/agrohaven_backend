import { requireUser } from '../middleware/auth.middleware';
import { equipmentService } from '../services/equipment.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type {
  ControlEquipmentInput,
  CreateEquipmentInput,
  ListEquipmentQuery,
  UpdateEquipmentInput,
} from '../validators/equipment.validator';

export const equipmentController = {
  create: asyncHandler(async (req, res) => {
    const data = await equipmentService.create(requireUser(req), req.body as CreateEquipmentInput);
    const message = data.delivered
      ? 'Equipment saved'
      : 'Equipment saved. The device is offline, so the configuration was not delivered.';
    sendSuccess(res, { status: 201, message, data });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await equipmentService.list(
      requireUser(req),
      req.query as unknown as ListEquipmentQuery,
    );
    sendSuccess(res, { message: 'Equipment retrieved', data: result.items, meta: result.meta });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await equipmentService.getById(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Equipment retrieved', data });
  }),

  status: asyncHandler(async (req, res) => {
    const data = await equipmentService.status(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Equipment status retrieved', data });
  }),

  control: asyncHandler(async (req, res) => {
    const data = await equipmentService.setPowerByType(
      requireUser(req),
      req.body as ControlEquipmentInput,
    );
    sendSuccess(res, { message: 'Equipment command queued', data });
  }),

  turnOn: asyncHandler(async (req, res) => {
    const data = await equipmentService.setPower(requireUser(req), req.params.id, 'ON');
    sendSuccess(res, { message: 'Power-on command queued', data });
  }),

  turnOff: asyncHandler(async (req, res) => {
    const data = await equipmentService.setPower(requireUser(req), req.params.id, 'OFF');
    sendSuccess(res, { message: 'Power-off command queued', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await equipmentService.update(
      requireUser(req),
      req.params.id,
      req.body as UpdateEquipmentInput,
    );
    const message = data.delivered
      ? 'Equipment updated'
      : 'Equipment configuration saved. The device is offline, so it has not been delivered.';
    sendSuccess(res, { message, data });
  }),
};
