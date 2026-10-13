import type { NextFunction, Request, Response } from 'express';
import { deviceRepository } from '../repositories/device.repository';
import { ApiError } from '../utils/api-error';
import { verifyDeviceKey } from '../utils/secrets';
import { authenticate } from './auth.middleware';

export async function authenticateDevice(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const deviceIdentifier = req.header('x-device-id')?.trim();
    const apiKey = req.header('x-device-key')?.trim();
    if (!deviceIdentifier || !apiKey) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Device authentication required');
    }

    const device = await deviceRepository.findByIdentifier(deviceIdentifier);
    const valid = verifyDeviceKey(apiKey, device?.apiKeyHash ?? null);
    if (!device || !valid) {
      throw new ApiError(401, 'INVALID_DEVICE_CREDENTIALS', 'Device credentials are invalid');
    }

    req.device = {
      id: device.id,
      deviceIdentifier: device.deviceIdentifier,
      farmingUnitId: device.farmingUnitId,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function authenticateUserOrDevice(req: Request, res: Response, next: NextFunction): void {
  if (req.header('authorization')) {
    void authenticate(req, res, next);
    return;
  }
  void authenticateDevice(req, res, next);
}
