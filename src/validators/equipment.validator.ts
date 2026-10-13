import { EquipmentStatus, EquipmentType, PowerState } from '@prisma/client';
import { z } from 'zod';
import { configurationSchema, paginationQuery, sortFields } from './common.validator';
import { sanitizeText } from '../utils/sanitize';

export const createEquipmentSchema = z
  .object({
    farmingUnitId: z.string().uuid(),
    name: z.string().trim().min(2).max(120).transform(sanitizeText),
    type: z.nativeEnum(EquipmentType),
    status: z.nativeEnum(EquipmentStatus).optional(),
    powerState: z.nativeEnum(PowerState).optional(),
    configuration: configurationSchema.optional(),
  })
  .strict();

export const updateEquipmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120).transform(sanitizeText).optional(),
    status: z.nativeEnum(EquipmentStatus).optional(),
    configuration: configurationSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listEquipmentQuery = paginationQuery.extend({
  farmingUnitId: z.string().uuid(),
  type: z.nativeEnum(EquipmentType).optional(),
  ...sortFields(['name', 'type', 'createdAt'] as const),
});

export const controlEquipmentSchema = z
  .object({
    farmingUnitId: z.string().uuid(),
    type: z.nativeEnum(EquipmentType),
    powerState: z.nativeEnum(PowerState),
  })
  .strict();

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type ControlEquipmentInput = z.infer<typeof controlEquipmentSchema>;
export type ListEquipmentQuery = z.infer<typeof listEquipmentQuery>;
