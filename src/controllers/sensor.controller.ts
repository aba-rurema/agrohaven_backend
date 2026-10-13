import { SENSOR_LIMITS } from '../config/constants';
import { requireUser } from '../middleware/auth.middleware';
import { sensorService } from '../services/sensor.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type { CreateReadingInput, SensorHistoryQuery } from '../validators/sensor.validator';

export const sensorController = {
  metrics: asyncHandler(async (_req, res) => {
    sendSuccess(res, { message: 'Sensor metrics retrieved', data: SENSOR_LIMITS });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await sensorService.create(
      { user: req.user, device: req.device },
      req.body as CreateReadingInput,
    );
    sendSuccess(res, { status: 201, message: 'Sensor reading stored', data });
  }),

  latest: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string };
    const result = await sensorService.latest(requireUser(req), query.farmingUnitId);
    sendSuccess(res, {
      message: 'Latest sensor reading retrieved',
      data: result.reading,
      meta: result.meta,
    });
  }),

  history: asyncHandler(async (req, res) => {
    const result = await sensorService.history(
      requireUser(req),
      req.query as unknown as SensorHistoryQuery,
    );
    sendSuccess(res, {
      message: 'Sensor history retrieved',
      data: result.items,
      meta: result.meta,
    });
  }),

  daily: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string; date?: string };
    const data = await sensorService.daily(requireUser(req), query.farmingUnitId, query.date);
    sendSuccess(res, { message: 'Daily sensor statistics retrieved', data });
  }),

  weekly: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string; date?: string };
    const data = await sensorService.weekly(requireUser(req), query.farmingUnitId, query.date);
    sendSuccess(res, { message: 'Weekly sensor statistics retrieved', data });
  }),

  monthly: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string; year?: number; month?: number };
    const data = await sensorService.monthly(
      requireUser(req),
      query.farmingUnitId,
      query.year,
      query.month,
    );
    sendSuccess(res, { message: 'Monthly sensor statistics retrieved', data });
  }),
};
