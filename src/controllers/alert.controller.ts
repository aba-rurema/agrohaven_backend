import { requireUser } from '../middleware/auth.middleware';
import { alertService } from '../services/alert.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type { ListAlertsQuery } from '../validators/alert.validator';

export const alertController = {
  list: asyncHandler(async (req, res) => {
    const result = await alertService.list(
      requireUser(req),
      req.query as unknown as ListAlertsQuery,
    );
    sendSuccess(res, { message: 'Alerts retrieved', data: result.items, meta: result.meta });
  }),

  summary: asyncHandler(async (req, res) => {
    const data = await alertService.summary(requireUser(req));
    sendSuccess(res, { message: 'Alert summary retrieved', data });
  }),

  unread: asyncHandler(async (req, res) => {
    const result = await alertService.list(
      requireUser(req),
      req.query as unknown as ListAlertsQuery,
      true,
    );
    sendSuccess(res, { message: 'Unread alerts retrieved', data: result.items, meta: result.meta });
  }),

  markRead: asyncHandler(async (req, res) => {
    const data = await alertService.markRead(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Alert marked as read', data });
  }),

  markAllRead: asyncHandler(async (req, res) => {
    const data = await alertService.markAllRead(requireUser(req));
    sendSuccess(res, { message: 'Alerts marked as read', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await alertService.remove(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Alert deleted' });
  }),
};
