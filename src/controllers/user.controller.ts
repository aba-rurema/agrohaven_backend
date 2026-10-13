import { requireUser } from '../middleware/auth.middleware';
import { userService } from '../services/user.service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type { UpdateProfileInput } from '../validators/auth.validator';

export const userController = {
  me: asyncHandler(async (req, res) => {
    const data = await userService.getMe(requireUser(req));
    sendSuccess(res, { message: 'Current user retrieved', data });
  }),

  settings: asyncHandler(async (req, res) => {
    const data = await userService.settings(requireUser(req));
    sendSuccess(res, { message: 'Settings retrieved', data });
  }),

  updateMe: asyncHandler(async (req, res) => {
    const data = await userService.updateProfile(requireUser(req), req.body as UpdateProfileInput);
    sendSuccess(res, { message: 'Profile updated', data });
  }),
};
