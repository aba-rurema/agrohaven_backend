import { z } from 'zod';
import { notesSchema, paginationQuery, sortFields } from './common.validator';

export const createHarvestSchema = z
  .object({
    cropId: z.string().uuid(),
    quantity: z.number().finite().positive(),
    unit: z.string().trim().min(1).max(20),
    harvestDate: z.coerce.date(),
    quality: z.string().trim().min(1).max(40).optional(),
    notes: notesSchema.optional(),
    markCropHarvested: z.boolean().optional(),
  })
  .strict();

export const listHarvestsQuery = paginationQuery.extend({
  cropId: z.string().uuid().optional(),
  farmingUnitId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ...sortFields(['harvestDate', 'quantity', 'createdAt'] as const),
});

export type CreateHarvestInput = z.infer<typeof createHarvestSchema>;
export type ListHarvestsQuery = z.infer<typeof listHarvestsQuery>;
