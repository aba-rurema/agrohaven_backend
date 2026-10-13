import { z } from 'zod';
import { SENSOR_LIMITS } from '../config/constants';
import { dateOnlySchema, extraSensorsSchema, paginationQuery, sortFields } from './common.validator';

const metric = (min: number, max: number) => z.number().finite().min(min).max(max);

const readingFields = {
  temperature: metric(SENSOR_LIMITS.temperature.min, SENSOR_LIMITS.temperature.max).optional(),
  humidity: metric(SENSOR_LIMITS.humidity.min, SENSOR_LIMITS.humidity.max).optional(),
  lightIntensity: metric(
    SENSOR_LIMITS.lightIntensity.min,
    SENSOR_LIMITS.lightIntensity.max,
  ).optional(),
  airQuality: metric(SENSOR_LIMITS.airQuality.min, SENSOR_LIMITS.airQuality.max).optional(),
  waterLevel: metric(SENSOR_LIMITS.waterLevel.min, SENSOR_LIMITS.waterLevel.max).optional(),
  timestamp: z.coerce.date().optional(),
  extra: extraSensorsSchema.optional(),
};

function hasSensorValue(value: {
  temperature?: number;
  humidity?: number;
  lightIntensity?: number;
  airQuality?: number;
  waterLevel?: number;
  extra?: Record<string, unknown>;
}): boolean {
  return (
    value.temperature !== undefined ||
    value.humidity !== undefined ||
    value.lightIntensity !== undefined ||
    value.airQuality !== undefined ||
    value.waterLevel !== undefined ||
    (value.extra !== undefined && Object.keys(value.extra).length > 0)
  );
}

export const deviceTelemetrySchema = z
  .object(readingFields)
  .strict()
  .refine(hasSensorValue, { message: 'At least one sensor value is required' });

export const createReadingSchema = z
  .object({
    farmingUnitId: z.string().uuid().optional(),
    ...readingFields,
  })
  .strict()
  .refine(hasSensorValue, { message: 'At least one sensor value is required' });

export const sensorHistoryQuery = paginationQuery.extend({
  farmingUnitId: z.string().uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ...sortFields(['timestamp'] as const),
});

export const latestReadingQuery = z.object({
  farmingUnitId: z.string().uuid(),
});

export const dailyStatQuery = z.object({
  farmingUnitId: z.string().uuid(),
  date: dateOnlySchema.optional(),
});

export const monthlyStatQuery = z.object({
  farmingUnitId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type CreateReadingInput = z.infer<typeof createReadingSchema>;
export type DeviceTelemetryInput = z.infer<typeof deviceTelemetrySchema>;
export type SensorHistoryQuery = z.infer<typeof sensorHistoryQuery>;
