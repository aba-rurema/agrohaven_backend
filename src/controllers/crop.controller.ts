import { requireUser } from '../middleware/auth.middleware';
import { cropService } from '../services/crop.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type {
  CreateCropInput,
  ListCropsQuery,
  UpdateCropInput,
} from '../validators/crop.validator';

export const cropController = {
  create: asyncHandler(async (req, res) => {
    const data = await cropService.create(requireUser(req), req.body as CreateCropInput);
    sendSuccess(res, { status: 201, message: 'Crop created', data });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await cropService.list(requireUser(req), req.query as unknown as ListCropsQuery);
    sendSuccess(res, { message: 'Crops retrieved', data: result.items, meta: result.meta });
  }),

  statistics: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string };
    const data = await cropService.statistics(requireUser(req), query.farmingUnitId);
    sendSuccess(res, { message: 'Crop statistics retrieved', data });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await cropService.getById(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Crop retrieved', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await cropService.update(
      requireUser(req),
      req.params.id,
      req.body as UpdateCropInput,
    );
    sendSuccess(res, { message: 'Crop updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await cropService.remove(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Crop deleted' });
  }),
};
