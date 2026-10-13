import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimit,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), authController.login);
authRouter.post(
  '/forgot-password',
  authRateLimit,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authRateLimit,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch(
  '/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile,
);
authRouter.post(
  '/change-password',
  authRateLimit,
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
