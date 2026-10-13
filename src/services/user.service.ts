import { Prisma } from '@prisma/client';
import { SENSOR_LIMITS } from '../config/constants';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { toPublicUser } from '../utils/mappers';
import type { UpdateProfileInput } from '../validators/auth.validator';

export const userService = {
  async getMe(user: AuthUser) {
    const record = await userRepository.findPublicById(user.id);
    if (!record) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    return toPublicUser(record);
  },

  async updateProfile(user: AuthUser, input: UpdateProfileInput) {
    const data: Prisma.UserUpdateInput = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.location !== undefined) data.location = input.location;
    if (input.profileImage !== undefined) data.profileImage = input.profileImage;

    const updated = await userRepository.updateProfile(user.id, data);
    return toPublicUser(updated);
  },

  async settings(user: AuthUser) {
    const profile = await this.getMe(user);
    return {
      profile,
      operations: {
        timezone: env.TIMEZONE,
        deviceOfflineAfterMinutes: env.DEVICE_OFFLINE_AFTER_MINUTES,
        lowWaterPercent: env.LOW_WATER_PERCENT,
        highTemperatureCelsius: env.HIGH_TEMPERATURE_CELSIUS,
        alertDedupeMinutes: env.ALERT_DEDUPE_MINUTES,
      },
      sensors: SENSOR_LIMITS,
    };
  },
};
