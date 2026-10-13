import { Router } from 'express';
import { cropController } from '../controllers/crop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { idParamSchema } from '../validators/common.validator';
import {
  createCropSchema,
  cropStatsQuery,
  listCropsQuery,
  updateCropSchema,
} from '../validators/crop.validator';

export const cropRouter = Router();

cropRouter.use(authenticate);
cropRouter.post('/', validate({ body: createCropSchema }), cropController.create);
cropRouter.get('/statistics', validate({ query: cropStatsQuery }), cropController.statistics);
cropRouter.get('/', validate({ query: listCropsQuery }), cropController.list);
cropRouter.get('/:id', validate({ params: idParamSchema }), cropController.get);
cropRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateCropSchema }),
  cropController.update,
);
cropRouter.delete('/:id', validate({ params: idParamSchema }), cropController.remove);
