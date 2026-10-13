import type { PowerState, SensorReading } from '@prisma/client';
import { env } from '../../config/env';
import { alertRepository } from '../../repositories/alert.repository';
import { automationRepository } from '../../repositories/automation.repository';
import { commandRepository } from '../../repositories/command.repository';
import { deviceRepository } from '../../repositories/device.repository';
import { equipmentRepository } from '../../repositories/equipment.repository';
import { farmingUnitRepository } from '../../repositories/farming-unit.repository';
import { logger } from '../../utils/logger';
import { formatHm, getZonedWeekday, isWithinTimeWindow } from '../../utils/time';
import { isDeviceOnline } from '../devices/presence';
import {
  alertActionSchema,
  equipmentActionSchema,
  scheduleConditionSchema,
  thresholdConditionSchema,
  type AlertAction,
  type EquipmentAction,
  type ScheduleCondition,
  type ThresholdCondition,
} from '../../validators/automation.validator';

type MetricReading = {
  temperature: number | null;
  humidity: number | null;
  lightIntensity: number | null;
  airQuality: number | null;
  waterLevel: number | null;
};

function matchesThreshold(reading: MetricReading, condition: ThresholdCondition): boolean {
  const actual = reading[condition.metric];
  if (actual === null || actual === undefined) return false;
  switch (condition.operator) {
    case 'lt':
      return actual < condition.value;
    case 'lte':
      return actual <= condition.value;
    case 'gt':
      return actual > condition.value;
    case 'gte':
      return actual >= condition.value;
    case 'eq':
      return actual === condition.value;
    default:
      return false;
  }
}

function opposite(state: PowerState): PowerState {
  return state === 'ON' ? 'OFF' : 'ON';
}

async function createDedupedAlert(input: {
  userId: string;
  farmingUnitId: string;
  type: AlertAction['alertType'];
  severity: AlertAction['severity'];
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

async function applyEquipmentAction(
  farmingUnitId: string,
  ownerId: string,
  action: EquipmentAction,
  source: { automationId: string },
): Promise<void> {
  const device = await deviceRepository.findByFarmingUnitId(farmingUnitId);
  const items = await equipmentRepository.findByUnitAndType(farmingUnitId, action.equipmentType);
  if (items.length > 0 && items.every((item) => item.powerState === action.powerState)) return;

  if (!device) {
    await createDedupedAlert({
      userId: ownerId,
      farmingUnitId,
      type: 'SYSTEM_ERROR',
      severity: 'WARNING',
      title: 'Automation could not run',
      message:
        'No device is registered on this farming unit, so the equipment command was not applied.',
    });
    return;
  }

  if (items.length === 0) {
    await createDedupedAlert({
      userId: ownerId,
      farmingUnitId,
      type: 'SYSTEM_ERROR',
      severity: 'WARNING',
      title: 'Automation could not run',
      message: `No ${action.equipmentType} equipment is registered on this farming unit.`,
    });
    return;
  }

  if (!isDeviceOnline(device)) {
    await createDedupedAlert({
      userId: ownerId,
      farmingUnitId,
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: 'Device offline',
      message:
        'An automation tried to control equipment while the device was offline. The command was not applied.',
    });
    return;
  }

  for (const item of items) {
    if (item.powerState === action.powerState) continue;
    await equipmentRepository.update(item.id, { powerState: action.powerState });
    await commandRepository.create({
      deviceId: device.id,
      equipmentId: item.id,
      command: 'SET_POWER',
      payload: {
        powerState: action.powerState,
        equipmentType: item.type,
        source: 'automation',
        automationId: source.automationId,
      },
      status: 'PENDING',
    });
  }
}

async function applyParsedAction(
  farmingUnitId: string,
  ownerId: string,
  automationId: string,
  action: EquipmentAction | AlertAction,
): Promise<void> {
  if (action.kind === 'alert') {
    await createDedupedAlert({
      userId: ownerId,
      farmingUnitId,
      type: action.alertType,
      severity: action.severity,
      title: action.title,
      message: action.message,
    });
    return;
  }
  await applyEquipmentAction(farmingUnitId, ownerId, action, { automationId });
}

export async function evaluateReadingAutomations(reading: SensorReading): Promise<void> {
  const [rules, unit] = await Promise.all([
    automationRepository.listEnabledForUnit(reading.farmingUnitId),
    farmingUnitRepository.findById(reading.farmingUnitId),
  ]);
  if (!unit) return;

  for (const rule of rules) {
    if (rule.type === 'SCHEDULE') continue;
    try {
      const condition = thresholdConditionSchema.parse(rule.condition);
      if (!matchesThreshold(reading, condition)) continue;
      const action =
        rule.type === 'ALERT'
          ? alertActionSchema.parse(rule.action)
          : equipmentActionSchema.or(alertActionSchema).parse(rule.action);
      await applyParsedAction(unit.id, unit.ownerId, rule.id, action);
    } catch (error) {
      logger.error('Skipped an automation rule that could not be evaluated', {
        automationId: rule.id,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

function scheduleIsOpen(condition: ScheduleCondition, now: Date): boolean {
  const weekday = getZonedWeekday(now);
  if (!condition.daysOfWeek.includes(weekday)) return false;
  return isWithinTimeWindow(formatHm(now), condition.startTime, condition.endTime);
}

export async function evaluateScheduleAutomations(now = new Date()): Promise<void> {
  const rules = await automationRepository.listEnabledByType('SCHEDULE');
  for (const rule of rules) {
    try {
      const condition = scheduleConditionSchema.parse(rule.condition);
      const action = equipmentActionSchema.parse(rule.action);
      const desired: EquipmentAction = scheduleIsOpen(condition, now)
        ? action
        : { ...action, powerState: opposite(action.powerState) };
      await applyEquipmentAction(rule.farmingUnitId, rule.farmingUnit.ownerId, desired, {
        automationId: rule.id,
      });
    } catch (error) {
      logger.error('Skipped a schedule automation', {
        automationId: rule.id,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
