import { Router } from 'express';
import { automationController } from '../controllers/automation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { idParamSchema } from '../validators/common.validator';
import {
  createAutomationSchema,
  enabledSchema,
  listAutomationsQuery,
  updateAutomationSchema,
} from '../validators/automation.validator';

export const automationRouter = Router();

automationRouter.use(authenticate);
automationRouter.post('/', validate({ body: createAutomationSchema }), automationController.create);
automationRouter.get('/', validate({ query: listAutomationsQuery }), automationController.list);
automationRouter.patch(
  '/:id/enabled',
  validate({ params: idParamSchema, body: enabledSchema }),
  automationController.setEnabled,
);
automationRouter.get('/:id', validate({ params: idParamSchema }), automationController.get);
automationRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateAutomationSchema }),
  automationController.update,
);
automationRouter.delete('/:id', validate({ params: idParamSchema }), automationController.remove);
