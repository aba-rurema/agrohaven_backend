import { z } from 'zod';
import { dateOnlySchema, paginationQuery, sortFields } from './common.validator';

export const createWaterUsageSchema = z
  .object({
    farmingUnitId: z.string().uuid(),
    amountUsed: z.number().finite().positive(),
    unit: z.string().trim().min(1).max(20).default('liters'),
    recordedAt: z.coerce.date().optional(),
  })
  .strict();

export const waterHistoryQuery = paginationQuery.extend({
  farmingUnitId: z.string().uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ...sortFields(['recordedAt', 'amountUsed'] as const),
});

export const waterDailyQuery = z.object({
  farmingUnitId: z.string().uuid(),
  date: dateOnlySchema.optional(),
});

export const waterMonthlyQuery = z.object({
  farmingUnitId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const waterTotalQuery = z.object({
  farmingUnitId: z.string().uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const waterStatisticsQuery = waterTotalQuery.extend({
  baselineAmount: z.coerce.number().finite().nonnegative().optional(),
  baselineUnit: z.string().trim().min(1).max(20).optional(),
});

export type CreateWaterUsageInput = z.infer<typeof createWaterUsageSchema>;
export type WaterHistoryQuery = z.infer<typeof waterHistoryQuery>;
export type WaterStatisticsQuery = z.infer<typeof waterStatisticsQuery>;
