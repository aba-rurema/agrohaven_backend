import { requireUser } from '../middleware/auth.middleware';
import { automationService } from '../services/automation.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type {
  CreateAutomationInput,
  UpdateAutomationInput,
} from '../validators/automation.validator';

export const automationController = {
  create: asyncHandler(async (req, res) => {
    const data = await automationService.create(
      requireUser(req),
      req.body as CreateAutomationInput,
    );
    sendSuccess(res, { status: 201, message: 'Automation created', data });
  }),

  list: asyncHandler(async (req, res) => {
    const query = req.query as unknown as { farmingUnitId: string };
    const data = await automationService.list(requireUser(req), query.farmingUnitId);
    sendSuccess(res, { message: 'Automations retrieved', data });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await automationService.getById(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Automation retrieved', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await automationService.update(
      requireUser(req),
      req.params.id,
      req.body as UpdateAutomationInput,
    );
    sendSuccess(res, { message: 'Automation updated', data });
  }),

  setEnabled: asyncHandler(async (req, res) => {
    const body = req.body as { enabled: boolean };
    const data = await automationService.setEnabled(requireUser(req), req.params.id, body.enabled);
    sendSuccess(res, {
      message: body.enabled ? 'Automation enabled' : 'Automation disabled',
      data,
    });
  }),

  remove: asyncHandler(async (req, res) => {
    await automationService.remove(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Automation deleted' });
  }),
};
