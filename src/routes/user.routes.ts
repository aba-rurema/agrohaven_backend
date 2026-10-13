import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../validators/auth.validator';

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.get('/me', userController.me);
userRouter.get('/me/settings', userController.settings);
userRouter.patch('/me', validate({ body: updateProfileSchema }), userController.updateMe);
