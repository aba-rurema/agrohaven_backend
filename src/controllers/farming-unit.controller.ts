import type { FarmingUnitStatus } from '@prisma/client';
import { requireUser } from '../middleware/auth.middleware';
import { farmingUnitService } from '../services/farming-unit.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type {
  CreateFarmingUnitInput,
  ListFarmingUnitsQuery,
  UpdateFarmingUnitInput,
} from '../validators/farming-unit.validator';

export const farmingUnitController = {
  create: asyncHandler(async (req, res) => {
    const data = await farmingUnitService.create(
      requireUser(req),
      req.body as CreateFarmingUnitInput,
    );
    sendSuccess(res, { status: 201, message: 'Farming unit created', data });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await farmingUnitService.list(
      requireUser(req),
      req.query as unknown as ListFarmingUnitsQuery,
    );
    sendSuccess(res, { message: 'Farming units retrieved', data: result.items, meta: result.meta });
  }),

  overview: asyncHandler(async (req, res) => {
    const data = await farmingUnitService.overview(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Farming unit overview retrieved', data });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await farmingUnitService.getById(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Farming unit retrieved', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await farmingUnitService.update(
      requireUser(req),
      req.params.id,
      req.body as UpdateFarmingUnitInput,
    );
    sendSuccess(res, { message: 'Farming unit updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await farmingUnitService.remove(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Farming unit deleted' });
  }),

  assign: asyncHandler(async (req, res) => {
    const body = req.body as { userId: string };
    const data = await farmingUnitService.assign(req.params.id, body.userId);
    sendSuccess(res, { message: 'Farming unit assigned', data });
  }),

  changeStatus: asyncHandler(async (req, res) => {
    const body = req.body as { status: FarmingUnitStatus };
    const data = await farmingUnitService.changeStatus(
      requireUser(req),
      req.params.id,
      body.status,
    );
    sendSuccess(res, { message: 'Farming unit status updated', data });
  }),
};
