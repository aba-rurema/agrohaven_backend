import { Prisma } from '@prisma/client';
import { deviceRepository } from '../repositories/device.repository';
import { farmingUnitRepository } from '../repositories/farming-unit.repository';
import { sensorRepository } from '../repositories/sensor.repository';
import type { AuthUser, DevicePrincipal } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import { isDeviceOnline } from '../modules/devices/presence';
import { getZonedCalendar, parseDateOnly, zonedMonthRange, zonedWeekRange } from '../utils/time';
import type { CreateReadingInput, SensorHistoryQuery } from '../validators/sensor.validator';
import { requireFarmingUnit } from './access.service';
import { evaluateReadingAutomations } from '../modules/automation/engine';
import { evaluateSensorThresholds } from '../modules/sensors/thresholds';
import { summarizeSensorPeriod } from '../modules/sensors/statistics';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const ONE_DAY = 24 * 60 * 60 * 1000;

export const sensorService = {
  async create(actor: { user?: AuthUser; device?: DevicePrincipal }, input: CreateReadingInput) {
    let farmingUnitId: string;
    let deviceId: string;
    let fromDevice = false;

    if (actor.device) {
      if (!actor.device.farmingUnitId) {
        throw new ApiError(409, 'NO_DEVICE', 'Device is not linked to a farming unit');
      }
      farmingUnitId = actor.device.farmingUnitId;
      deviceId = actor.device.id;
      fromDevice = true;
    } else if (actor.user) {
      if (!input.farmingUnitId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'farmingUnitId is required');
      }
      await requireFarmingUnit(actor.user, input.farmingUnitId, 'operate');
      const linked = await deviceRepository.findByFarmingUnitId(input.farmingUnitId);
      if (!linked) {
        throw new ApiError(409, 'NO_DEVICE', 'Register a device before uploading sensor readings');
      }
      farmingUnitId = input.farmingUnitId;
      deviceId = linked.id;
    } else {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const timestamp = input.timestamp ?? new Date();
    const now = Date.now();
    if (timestamp.getTime() > now + ONE_DAY) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Sensor timestamp cannot be more than a day in the future',
      );
    }
    if (timestamp.getTime() < now - 366 * ONE_DAY) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Sensor timestamp is too far in the past');
    }

    const reading = await sensorRepository.create({
      deviceId,
      farmingUnitId,
      temperature: input.temperature,
      humidity: input.humidity,
      lightIntensity: input.lightIntensity,
      airQuality: input.airQuality,
      waterLevel: input.waterLevel,
      extra: input.extra as Prisma.InputJsonValue | undefined,
      timestamp,
    });

    if (fromDevice) {
      await deviceRepository.update(deviceId, { lastSeen: new Date(), status: 'ONLINE' });
      const unit = await farmingUnitRepository.findById(farmingUnitId);
      if (unit?.status === 'OFFLINE') {
        await farmingUnitRepository.update(farmingUnitId, { status: 'ACTIVE' });
      }
    }

    try {
      await evaluateReadingAutomations(reading);
    } catch (error) {
      logger.error(
        'Automation evaluation failed after sensor ingest',
        error instanceof Error ? error : undefined,
      );
    }

    try {
      const linked = await deviceRepository.findById(deviceId);
      await evaluateSensorThresholds(reading, linked?.configuration ?? null);
    } catch (error) {
      logger.error(
        'Threshold evaluation failed after sensor ingest',
        error instanceof Error ? error : undefined,
      );
    }

    return reading;
  },

  async latest(user: AuthUser, farmingUnitId: string) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const [reading, device] = await Promise.all([
      sensorRepository.latest(farmingUnitId),
      deviceRepository.findPublicByFarmingUnitId(farmingUnitId),
    ]);
    return {
      reading,
      meta: {
        deviceOnline: device ? isDeviceOnline(device) : false,
        deviceStatus: device?.status ?? null,
        lastSeen: device?.lastSeen ?? null,
      },
    };
  },

  async history(user: AuthUser, query: SensorHistoryQuery) {
    await requireFarmingUnit(user, query.farmingUnitId, 'read');
    if (query.from && query.to && query.from >= query.to) {
      throw new ApiError(400, 'VALIDATION_ERROR', '`from` must be earlier than `to`');
    }
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'timestamp', query.order);
    const [items, total] = await sensorRepository.list({
      farmingUnitId: query.farmingUnitId,
      from: query.from,
      to: query.to,
      sort: 'timestamp',
      order: sort.order,
      skip,
      take,
    });
    return { items, meta: pageMeta(query.page, query.limit, total, sort) };
  },

  async daily(user: AuthUser, farmingUnitId: string, date?: string) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const day = date ?? formatToday();
    const range = parseDateOnly(day);
    const summary = await summarizeSensorPeriod({
      farmingUnitId,
      from: range.start,
      to: range.end,
    });
    return { period: 'daily', date: day, ...summary };
  },

  async weekly(user: AuthUser, farmingUnitId: string, date?: string) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const anchor = date ? parseDateOnly(date).start : new Date();
    const range = zonedWeekRange(anchor);
    const summary = await summarizeSensorPeriod({
      farmingUnitId,
      from: range.start,
      to: range.end,
    });
    return { period: 'weekly', weekStartsOn: 'monday', ...summary };
  },

  async monthly(user: AuthUser, farmingUnitId: string, year?: number, month?: number) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const today = getZonedCalendar(new Date(), env.TIMEZONE);
    const selectedYear = year ?? today.year;
    const selectedMonth = month ?? today.month;
    const range = zonedMonthRange(selectedYear, selectedMonth);
    const summary = await summarizeSensorPeriod({
      farmingUnitId,
      from: range.start,
      to: range.end,
    });
    return { period: 'monthly', year: selectedYear, month: selectedMonth, ...summary };
  },
};

function formatToday(): string {
  const parts = getZonedCalendar(new Date(), env.TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
