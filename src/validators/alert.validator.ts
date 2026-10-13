import { AlertSeverity, AlertType } from '@prisma/client';
import { z } from 'zod';
import { optionalBooleanQuery, paginationQuery, sortFields } from './common.validator';

export const listAlertsQuery = paginationQuery.extend({
  farmingUnitId: z.string().uuid().optional(),
  type: z.nativeEnum(AlertType).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  isRead: optionalBooleanQuery,
  ...sortFields(['createdAt', 'severity'] as const),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuery>;
