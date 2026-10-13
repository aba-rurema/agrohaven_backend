import { z } from 'zod';
import { PASSWORD_MAX, PASSWORD_MIN } from '../config/constants';
import { sanitizeText } from '../utils/sanitize';

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN)
  .max(PASSWORD_MAX)
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX, 'Password is too long');

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

export const fullNameSchema = z.string().trim().min(2).max(120).transform(sanitizeText);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Enter a valid phone number')
  .transform((value) => value.replace(/\s+/g, ' '));

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function sortFields<const T extends readonly [string, ...string[]]>(fields: T) {
  return {
    sort: z.enum(fields).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  };
}

export const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const commandIdParamSchema = z.object({
  commandId: z.string().uuid(),
});

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const notesSchema = z.string().trim().max(2000).transform(sanitizeText);

const configurationKey = z.string().trim().min(1).max(40);
const configurationPrimitive = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

function configurationValue(depth: number): z.ZodType {
  if (depth <= 0) return configurationPrimitive;
  return z.union([
    configurationPrimitive,
    z.array(configurationValue(depth - 1)).max(20),
    z
      .record(configurationKey, configurationValue(depth - 1))
      .refine((value) => Object.keys(value).length <= 40, 'Too many configuration fields'),
  ]);
}

export const configurationSchema = z
  .record(configurationKey, configurationValue(4))
  .refine((value) => Object.keys(value).length <= 40, 'Too many configuration fields');

export const extraSensorsSchema = z
  .record(
    z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/, 'Sensor keys must be identifiers'),
    z.union([z.number().finite(), z.string().max(120), z.boolean()]),
  )
  .refine((value) => Object.keys(value).length <= 20, 'Too many extra sensor fields');
