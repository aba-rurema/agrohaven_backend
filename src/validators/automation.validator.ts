import {
  AlertSeverity,
  AlertType,
  AutomationType,
  EquipmentType,
  PowerState,
} from '@prisma/client';
import { z, ZodError } from 'zod';
import { sanitizeText } from '../utils/sanitize';

export const thresholdConditionSchema = z
  .object({
    metric: z.enum(['temperature', 'humidity', 'lightIntensity', 'airQuality', 'waterLevel']),
    operator: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']),
    value: z.number().finite(),
  })
  .strict();

export const scheduleConditionSchema = z
  .object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .strict();

export const equipmentActionSchema = z
  .object({
    kind: z.literal('equipment'),
    equipmentType: z.nativeEnum(EquipmentType),
    powerState: z.nativeEnum(PowerState),
  })
  .strict();

export const alertActionSchema = z
  .object({
    kind: z.literal('alert'),
    alertType: z.nativeEnum(AlertType),
    severity: z.nativeEnum(AlertSeverity),
    title: z.string().trim().min(3).max(140).transform(sanitizeText),
    message: z.string().trim().min(3).max(500).transform(sanitizeText),
  })
  .strict();

const actionSchema = z.union([equipmentActionSchema, alertActionSchema]);

export function parseAutomationPayload(type: AutomationType, condition: unknown, action: unknown) {
  if (type === 'SCHEDULE') {
    return {
      condition: scheduleConditionSchema.parse(condition),
      action: equipmentActionSchema.parse(action),
    };
  }
  if (type === 'ALERT') {
    return {
      condition: thresholdConditionSchema.parse(condition),
      action: alertActionSchema.parse(action),
    };
  }
  return {
    condition: thresholdConditionSchema.parse(condition),
    action: actionSchema.parse(action),
  };
}

export const createAutomationSchema = z
  .object({
    farmingUnitId: z.string().uuid(),
    name: z.string().trim().min(2).max(120).transform(sanitizeText),
    type: z.nativeEnum(AutomationType),
    condition: z.unknown(),
    action: z.unknown(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      parseAutomationPayload(value.type, value.condition, value.action);
    } catch (error) {
      if (error instanceof ZodError) {
        for (const issue of error.issues) {
          ctx.addIssue(issue);
        }
        return;
      }
      ctx.addIssue({ code: 'custom', message: 'Invalid automation condition or action' });
    }
  });

export const updateAutomationSchema = z
  .object({
    name: z.string().trim().min(2).max(120).transform(sanitizeText).optional(),
    type: z.nativeEnum(AutomationType).optional(),
    condition: z.unknown().optional(),
    action: z.unknown().optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const enabledSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const listAutomationsQuery = z.object({
  farmingUnitId: z.string().uuid(),
});

export type ThresholdCondition = z.infer<typeof thresholdConditionSchema>;
export type ScheduleCondition = z.infer<typeof scheduleConditionSchema>;
export type EquipmentAction = z.infer<typeof equipmentActionSchema>;
export type AlertAction = z.infer<typeof alertActionSchema>;
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
