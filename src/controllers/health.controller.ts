import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

export const healthController = {
  get: asyncHandler(async (_req, res) => {
    sendSuccess(res, { message: 'AgroHaven API is running' });
  }),
};
