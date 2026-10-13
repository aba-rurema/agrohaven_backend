import { requireUser } from '../middleware/auth.middleware';
import { harvestService } from '../services/harvest.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type { CreateHarvestInput, ListHarvestsQuery } from '../validators/harvest.validator';

export const harvestController = {
  create: asyncHandler(async (req, res) => {
    const data = await harvestService.create(requireUser(req), req.body as CreateHarvestInput);
    sendSuccess(res, { status: 201, message: 'Harvest recorded', data });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await harvestService.list(
      requireUser(req),
      req.query as unknown as ListHarvestsQuery,
    );
    sendSuccess(res, {
      message: 'Harvest history retrieved',
      data: result.items,
      meta: result.meta,
    });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await harvestService.getById(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Harvest retrieved', data });
  }),
};
