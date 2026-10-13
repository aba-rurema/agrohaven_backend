import { requireUser } from '../middleware/auth.middleware';
import { adminService } from '../services/admin.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type { AdminCreateUserInput, AdminUserListQuery } from '../validators/admin.validator';
import type { ListAlertsQuery } from '../validators/alert.validator';
import type { ListDevicesQuery } from '../validators/device.validator';
import type { ListFarmingUnitsQuery } from '../validators/farming-unit.validator';

export const adminController = {
  listUsers: asyncHandler(async (req, res) => {
    const result = await adminService.listUsers(req.query as unknown as AdminUserListQuery);
    sendSuccess(res, { message: 'Users retrieved', data: result.items, meta: result.meta });
  }),

  createUser: asyncHandler(async (req, res) => {
    const data = await adminService.createUser(req.body as AdminCreateUserInput);
    sendSuccess(res, { status: 201, message: 'User created', data });
  }),

  setActivation: asyncHandler(async (req, res) => {
    const body = req.body as { isActive: boolean };
    const data = await adminService.setActivation(
      requireUser(req).id,
      req.params.id,
      body.isActive,
    );
    sendSuccess(res, { message: body.isActive ? 'User activated' : 'User deactivated', data });
  }),

  listFarmingUnits: asyncHandler(async (req, res) => {
    const result = await adminService.listFarmingUnits(
      req.query as unknown as ListFarmingUnitsQuery,
    );
    sendSuccess(res, { message: 'Farming units retrieved', data: result.items, meta: result.meta });
  }),

  listDevices: asyncHandler(async (req, res) => {
    const result = await adminService.listDevices(req.query as unknown as ListDevicesQuery);
    sendSuccess(res, { message: 'Devices retrieved', data: result.items, meta: result.meta });
  }),

  listAlerts: asyncHandler(async (req, res) => {
    const result = await adminService.listAlerts(req.query as unknown as ListAlertsQuery);
    sendSuccess(res, { message: 'System alerts retrieved', data: result.items, meta: result.meta });
  }),

  sensorStatistics: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { from?: Date; to?: Date };
    const data = await adminService.sensorStatistics(query.from, query.to);
    sendSuccess(res, { message: 'Sensor statistics retrieved', data });
  }),

  statistics: asyncHandler(async (_req, res) => {
    const data = await adminService.statistics();
    sendSuccess(res, { message: 'System statistics retrieved', data });
  }),
};
