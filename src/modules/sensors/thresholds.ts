import { AlertSeverity, AlertType, type SensorReading } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../config/env';
import { alertRepository } from '../../repositories/alert.repository';
import { farmingUnitRepository } from '../../repositories/farming-unit.repository';
import { sanitizeText } from '../../utils/sanitize';

const CORE_METRICS = [
  'temperature',
  'humidity',
  'lightIntensity',
  'airQuality',
  'waterLevel',
] as const;

type Operator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';

type ThresholdRule = {
  metric: string;
  operator: Operator;
  value: number;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string | ((actual: number) => string);
};

const overrideSchema = z
  .object({
    value: z.number().finite().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const additionalRuleSchema = z
  .object({
    metric: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/),
    operator: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']),
    value: z.number().finite(),
    alertType: z.nativeEnum(AlertType),
    severity: z.nativeEnum(AlertSeverity),
    title: z.string().trim().min(3).max(140),
    message: z.string().trim().min(3).max(500),
  })
  .strict();

function readThresholdBag(configuration: unknown): Record<string, unknown> | null {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    return null;
  }
  const thresholds = (configuration as Record<string, unknown>).alertThresholds;
  if (!thresholds || typeof thresholds !== 'object' || Array.isArray(thresholds)) return null;
  return thresholds as Record<string, unknown>;
}

function crosses(actual: number, operator: Operator, value: number): boolean {
  switch (operator) {
    case 'lt':
      return actual < value;
    case 'lte':
      return actual <= value;
    case 'gt':
      return actual > value;
    case 'gte':
      return actual >= value;
    case 'eq':
      return actual === value;
    default:
      return false;
  }
}

function metricValue(reading: SensorReading, metric: string): number | null {
  if ((CORE_METRICS as readonly string[]).includes(metric)) {
    const value = reading[metric as (typeof CORE_METRICS)[number]];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  if (!reading.extra || typeof reading.extra !== 'object' || Array.isArray(reading.extra)) {
    return null;
  }
  const value = (reading.extra as Record<string, unknown>)[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function defaultRules(configuration: unknown): ThresholdRule[] {
  const bag = readThresholdBag(configuration);
  const specs: Array<ThresholdRule & { message: (actual: number) => string }> = [
    {
      metric: 'waterLevel',
      operator: 'lt',
      value: env.LOW_WATER_PERCENT,
      alertType: 'LOW_WATER',
      severity: 'CRITICAL',
      title: 'Low water level',
      message: (actual) =>
        `Recorded water level is ${actual} percent, below the configured threshold of ${env.LOW_WATER_PERCENT} percent.`,
    },
    {
      metric: 'temperature',
      operator: 'gt',
      value: env.HIGH_TEMPERATURE_CELSIUS,
      alertType: 'HIGH_TEMPERATURE',
      severity: 'WARNING',
      title: 'High temperature',
      message: (actual) =>
        `Recorded temperature is ${actual} celsius, above the configured threshold of ${env.HIGH_TEMPERATURE_CELSIUS} celsius.`,
    },
  ];

  const rules: ThresholdRule[] = [];
  for (const spec of specs) {
    const raw = bag?.[spec.metric];
    const parsed = raw === undefined ? null : overrideSchema.safeParse(raw);
    if (parsed?.success && parsed.data.enabled === false) continue;
    const value =
      parsed?.success && parsed.data.value !== undefined ? parsed.data.value : spec.value;
    const threshold = value;
    rules.push({
      ...spec,
      value,
      message: (actual) => {
        if (spec.metric === 'waterLevel') {
          return `Recorded water level is ${actual} percent, below the configured threshold of ${threshold} percent.`;
        }
        return `Recorded temperature is ${actual} celsius, above the configured threshold of ${threshold} celsius.`;
      },
    });
  }
  return rules;
}

function additionalRules(configuration: unknown): ThresholdRule[] {
  const bag = readThresholdBag(configuration);
  if (!bag || !Array.isArray(bag.additional)) return [];

  const rules: ThresholdRule[] = [];
  for (const item of bag.additional) {
    const parsed = additionalRuleSchema.safeParse(item);
    if (!parsed.success) continue;
    const title = sanitizeText(parsed.data.title);
    const message = sanitizeText(parsed.data.message);
    if (title.length < 3 || message.length < 3) continue;
    rules.push({
      metric: parsed.data.metric,
      operator: parsed.data.operator,
      value: parsed.data.value,
      alertType: parsed.data.alertType,
      severity: parsed.data.severity,
      title,
      message,
    });
  }
  return rules;
}

function resolveRules(configuration: unknown): ThresholdRule[] {
  return [...defaultRules(configuration), ...additionalRules(configuration)];
}

async function createDedupedAlert(input: {
  userId: string;
  farmingUnitId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
}) {
  const since = new Date(Date.now() - env.ALERT_DEDUPE_MINUTES * 60 * 1000);
  const existing = await alertRepository.findRecentDuplicate({
    userId: input.userId,
    farmingUnitId: input.farmingUnitId,
    type: input.type,
    since,
  });
  if (existing) return existing;
  return alertRepository.create(input);
}

export async function evaluateSensorThresholds(
  reading: SensorReading,
  configuration: unknown,
): Promise<void> {
  const unit = await farmingUnitRepository.findById(reading.farmingUnitId);
  if (!unit) return;

  for (const rule of resolveRules(configuration)) {
    const actual = metricValue(reading, rule.metric);
    if (actual === null || !crosses(actual, rule.operator, rule.value)) continue;
    const message = typeof rule.message === 'function' ? rule.message(actual) : rule.message;
    await createDedupedAlert({
      userId: unit.ownerId,
      farmingUnitId: unit.id,
      type: rule.alertType,
      severity: rule.severity,
      title: rule.title,
      message,
    });
  }
}
