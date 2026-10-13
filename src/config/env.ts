import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  DEVICE_OFFLINE_AFTER_MINUTES: z.coerce.number().int().positive().default(5),
  LOW_WATER_PERCENT: z.coerce.number().min(0).max(100).default(20),
  HIGH_TEMPERATURE_CELSIUS: z.coerce.number().min(-40).max(80).default(32),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  ALERT_DEDUPE_MINUTES: z.coerce.number().int().positive().default(60),
  TIMEZONE: z.string().min(1).default('Africa/Kigali'),
  RUN_BACKGROUND_JOBS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  PASSWORD_RESET_MINUTES: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_FROM: z.preprocess(emptyToUndefined, z.string().email().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;

export const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);
