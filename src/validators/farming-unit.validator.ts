import { FarmingUnitStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuery, sortFields } from './common.validator';
import { sanitizeText } from '../utils/sanitize';

const deviceSerial = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Device id contains unsupported characters');

export const createFarmingUnitSchema = z
  .object({
    name: z.string().trim().min(2).max(120).transform(sanitizeText),
    location: z.string().trim().min(2).max(255).transform(sanitizeText),
    deviceId: deviceSerial.optional(),
    installationDate: z.coerce.date().optional(),
    status: z.nativeEnum(FarmingUnitStatus).optional(),
    ownerId: z.string().uuid().optional(),
  })
  .strict();

export const updateFarmingUnitSchema = z
  .object({
    name: z.string().trim().min(2).max(120).transform(sanitizeText).optional(),
    location: z.string().trim().min(2).max(255).transform(sanitizeText).optional(),
    deviceId: deviceSerial.nullable().optional(),
    installationDate: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listFarmingUnitsQuery = paginationQuery.extend({
  status: z.nativeEnum(FarmingUnitStatus).optional(),
  search: z.string().trim().max(120).optional(),
  ...sortFields(['createdAt', 'name', 'status'] as const),
});

export const assignFarmingUnitSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();

export const farmingUnitStatusSchema = z
  .object({
    status: z.nativeEnum(FarmingUnitStatus),
  })
  .strict();

export type CreateFarmingUnitInput = z.infer<typeof createFarmingUnitSchema>;
export type UpdateFarmingUnitInput = z.infer<typeof updateFarmingUnitSchema>;
export type ListFarmingUnitsQuery = z.infer<typeof listFarmingUnitsQuery>;
