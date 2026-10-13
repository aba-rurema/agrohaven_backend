import { Router } from 'express';
import { harvestController } from '../controllers/harvest.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { idParamSchema } from '../validators/common.validator';
import { createHarvestSchema, listHarvestsQuery } from '../validators/harvest.validator';

export const harvestRouter = Router();

harvestRouter.use(authenticate);
harvestRouter.post('/', validate({ body: createHarvestSchema }), harvestController.create);
harvestRouter.get('/', validate({ query: listHarvestsQuery }), harvestController.list);
harvestRouter.get('/:id', validate({ params: idParamSchema }), harvestController.get);
