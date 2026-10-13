import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { listAlertsQuery } from '../validators/alert.validator';
import { idParamSchema } from '../validators/common.validator';

export const alertRouter = Router();

alertRouter.use(authenticate);
alertRouter.get('/', validate({ query: listAlertsQuery }), alertController.list);
alertRouter.get('/summary', alertController.summary);
alertRouter.get('/unread', validate({ query: listAlertsQuery }), alertController.unread);
alertRouter.patch('/read-all', alertController.markAllRead);
alertRouter.patch('/:id/read', validate({ params: idParamSchema }), alertController.markRead);
alertRouter.delete('/:id', validate({ params: idParamSchema }), alertController.remove);
