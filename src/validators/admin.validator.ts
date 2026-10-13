import { Role } from '@prisma/client';
import { z } from 'zod';
import {
  emailSchema,
  fullNameSchema,
  paginationQuery,
  passwordSchema,
  phoneSchema,
} from './common.validator';
import { dateOnlySchema } from './common.validator';

export const adminUserListQuery = paginationQuery.extend({
  role: z.nativeEnum(Role).optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const adminCreateUserSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema.optional(),
    password: passwordSchema,
    role: z.nativeEnum(Role),
    location: z.string().trim().min(2).max(255).optional(),
  })
  .strict();

export const activationSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const adminRangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const dashboardQuery = z.object({
  farmingUnitId: z.string().uuid().optional(),
});

export { dateOnlySchema };

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuery>;
