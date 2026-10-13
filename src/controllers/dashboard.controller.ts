import { requireUser } from '../middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

export const dashboardController = {
  get: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId?: string };
    const data = await dashboardService.get(requireUser(req), query.farmingUnitId);
    sendSuccess(res, { message: 'Dashboard retrieved', data });
  }),
};
