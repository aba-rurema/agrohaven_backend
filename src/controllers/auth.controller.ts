import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/api-response';
import { requireUser } from '../middleware/auth.middleware';
import { authService } from '../services/auth.service';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../validators/auth.validator';
import { userService } from '../services/user.service';

export const authController = {
  register: asyncHandler(async (req, res) => {
    const data = await authService.register(req.body as RegisterInput);
    sendSuccess(res, { status: 201, message: 'Account created', data });
  }),

  login: asyncHandler(async (req, res) => {
    const data = await authService.login(req.body as LoginInput);
    sendSuccess(res, { message: 'Login successful', data });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(requireUser(req), req.header('authorization'));
    sendSuccess(res, { message: 'Logged out' });
  }),

  me: asyncHandler(async (req, res) => {
    const data = await userService.getMe(requireUser(req));
    sendSuccess(res, { message: 'Current user retrieved', data });
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const data = await userService.updateProfile(requireUser(req), req.body as UpdateProfileInput);
    sendSuccess(res, { message: 'Profile updated', data });
  }),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(requireUser(req), req.body as ChangePasswordInput);
    sendSuccess(res, {
      message: 'Password changed. Log in again with the new password.',
      data: { sessionEnded: true },
    });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const body = req.body as { email: string };
    const data = await authService.forgotPassword(body.email);
    sendSuccess(res, { message: data.message });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body as ResetPasswordInput);
    sendSuccess(res, { message: 'Password has been reset' });
  }),
};
