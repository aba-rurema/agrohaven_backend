import { CropStatus } from '@prisma/client';
import { z } from 'zod';
import { notesSchema, paginationQuery, sortFields } from './common.validator';
import { sanitizeText } from '../utils/sanitize';

const cropFields = {
  name: z.string().trim().min(2).max(120).transform(sanitizeText),
  variety: z.string().trim().min(1).max(120).transform(sanitizeText).nullable().optional(),
  plantingDate: z.coerce.date(),
  expectedHarvestDate: z.coerce.date().nullable().optional(),
  actualHarvestDate: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(CropStatus).optional(),
  notes: notesSchema.nullable().optional(),
};

function refineCropDates(
  value: {
    plantingDate?: Date;
    expectedHarvestDate?: Date | null;
    actualHarvestDate?: Date | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (
    value.plantingDate &&
    value.expectedHarvestDate &&
    value.expectedHarvestDate < value.plantingDate
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['expectedHarvestDate'],
      message: 'Expected harvest date cannot be before the planting date',
    });
  }
  if (
    value.plantingDate &&
    value.actualHarvestDate &&
    value.actualHarvestDate < value.plantingDate
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['actualHarvestDate'],
      message: 'Actual harvest date cannot be before the planting date',
    });
  }
}

export const createCropSchema = z
  .object({
    farmingUnitId: z.string().uuid(),
    ...cropFields,
  })
  .strict()
  .superRefine(refineCropDates);

export const updateCropSchema = z
  .object({
    name: cropFields.name.optional(),
    variety: cropFields.variety,
    plantingDate: z.coerce.date().optional(),
    expectedHarvestDate: cropFields.expectedHarvestDate,
    actualHarvestDate: cropFields.actualHarvestDate,
    status: cropFields.status,
    notes: cropFields.notes,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })
  .superRefine(refineCropDates);

export const listCropsQuery = paginationQuery.extend({
  farmingUnitId: z.string().uuid(),
  status: z.nativeEnum(CropStatus).optional(),
  search: z.string().trim().max(120).optional(),
  ...sortFields(['plantingDate', 'name', 'status', 'createdAt'] as const),
});

export const cropStatsQuery = z.object({
  farmingUnitId: z.string().uuid(),
});

export type CreateCropInput = z.infer<typeof createCropSchema>;
export type UpdateCropInput = z.infer<typeof updateCropSchema>;
export type ListCropsQuery = z.infer<typeof listCropsQuery>;
