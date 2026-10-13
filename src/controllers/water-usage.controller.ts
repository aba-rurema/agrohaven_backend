import { requireUser } from '../middleware/auth.middleware';
import { waterUsageService } from '../services/water-usage.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type {
  CreateWaterUsageInput,
  WaterHistoryQuery,
  WaterStatisticsQuery,
} from '../validators/water-usage.validator';

export const waterUsageController = {
  create: asyncHandler(async (req, res) => {
    const data = await waterUsageService.create(
      requireUser(req),
      req.body as CreateWaterUsageInput,
    );
    sendSuccess(res, { status: 201, message: 'Water usage recorded', data });
  }),

  history: asyncHandler(async (req, res) => {
    const result = await waterUsageService.history(
      requireUser(req),
      req.query as unknown as WaterHistoryQuery,
    );
    sendSuccess(res, {
      message: 'Water usage history retrieved',
      data: result.items,
      meta: result.meta,
    });
  }),

  daily: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string; date?: string };
    const data = await waterUsageService.daily(requireUser(req), query.farmingUnitId, query.date);
    sendSuccess(res, { message: 'Daily water usage retrieved', data });
  }),

  monthly: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string; year?: number; month?: number };
    const data = await waterUsageService.monthly(
      requireUser(req),
      query.farmingUnitId,
      query.year,
      query.month,
    );
    sendSuccess(res, { message: 'Monthly water usage retrieved', data });
  }),

  total: asyncHandler(async (req, res) => {
    const data = await waterUsageService.total(
      requireUser(req),
      req.query as unknown as WaterStatisticsQuery,
    );
    sendSuccess(res, { message: 'Total water usage retrieved', data });
  }),

  statistics: asyncHandler(async (req, res) => {
    const data = await waterUsageService.statistics(
      requireUser(req),
      req.query as unknown as WaterStatisticsQuery,
    );
    sendSuccess(res, { message: 'Water usage statistics retrieved', data });
  }),
};
