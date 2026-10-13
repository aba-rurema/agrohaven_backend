import { DeviceStatus } from '@prisma/client';
import { z } from 'zod';
import { configurationSchema, paginationQuery } from './common.validator';

const deviceIdentifier = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Device identifier contains unsupported characters');

export const registerDeviceSchema = z
  .object({
    farmingUnitId: z.string().uuid(),
    deviceIdentifier,
    firmwareVersion: z.string().trim().min(1).max(40).optional(),
    configuration: configurationSchema.optional(),
  })
  .strict();

export const updateDeviceSchema = z
  .object({
    firmwareVersion: z.string().trim().min(1).max(40).optional(),
    configuration: configurationSchema.optional(),
    status: z.nativeEnum(DeviceStatus).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const heartbeatSchema = z
  .object({
    status: z.nativeEnum(DeviceStatus).optional(),
    firmwareVersion: z.string().trim().min(1).max(40).optional(),
    health: configurationSchema.optional(),
  })
  .strict();

export const listDevicesQuery = paginationQuery.extend({
  status: z.nativeEnum(DeviceStatus).optional(),
  farmingUnitId: z.string().uuid().optional(),
});

export const acknowledgeCommandSchema = z
  .object({
    status: z.enum(['ACKNOWLEDGED', 'FAILED']),
  })
  .strict();

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type ListDevicesQuery = z.infer<typeof listDevicesQuery>;
