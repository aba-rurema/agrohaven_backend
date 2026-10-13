import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { commandRepository } from '../repositories/command.repository';
import { deviceRepository } from '../repositories/device.repository';
import { farmingUnitRepository } from '../repositories/farming-unit.repository';
import type { AuthUser, DevicePrincipal } from '../types';
import { ApiError } from '../utils/api-error';
import { getPagination, pageMeta } from '../utils/pagination';
import { generateDeviceKey, hashDeviceKey } from '../utils/secrets';
import type {
  HeartbeatInput,
  ListDevicesQuery,
  RegisterDeviceInput,
  UpdateDeviceInput,
} from '../validators/device.validator';
import type { DeviceTelemetryInput } from '../validators/sensor.validator';
import { sensorService } from './sensor.service';
import { requireFarmingUnit } from './access.service';
import { alertRepository } from '../repositories/alert.repository';
import { env } from '../config/env';

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export const deviceService = {
  async register(user: AuthUser, input: RegisterDeviceInput) {
    const unit = await requireFarmingUnit(user, input.farmingUnitId, 'operate');
    if (unit.deviceId && unit.deviceId !== input.deviceIdentifier) {
      throw new ApiError(
        409,
        'DEVICE_MISMATCH',
        'This farming unit is reserved for a different device id',
      );
    }

    const linked = await deviceRepository.findByFarmingUnitId(unit.id);
    if (linked) throw new ApiError(409, 'CONFLICT', 'This farming unit already has a device');

    const identifierTaken = await deviceRepository.findByIdentifier(input.deviceIdentifier);
    if (identifierTaken)
      throw new ApiError(409, 'CONFLICT', 'This device identifier is already registered');

    const apiKey = generateDeviceKey();
    const device = await prisma.$transaction(async (tx) => {
      const created = await deviceRepository.create(
        {
          deviceIdentifier: input.deviceIdentifier,
          apiKeyHash: hashDeviceKey(apiKey),
          farmingUnitId: unit.id,
          firmwareVersion: input.firmwareVersion,
          configuration: toJson(input.configuration),
          status: 'OFFLINE',
        },
        tx,
      );
      await farmingUnitRepository.update(unit.id, { deviceId: input.deviceIdentifier }, tx);
      return created;
    });

    return { device, apiKey };
  },

  async list(user: AuthUser, query: ListDevicesQuery) {
    const { skip, take } = getPagination(query.page, query.limit);
    let farmingUnitIds: string[] | undefined;

    if (query.farmingUnitId) {
      await requireFarmingUnit(user, query.farmingUnitId, 'read');
      farmingUnitIds = [query.farmingUnitId];
    } else if (user.role === 'CUSTOMER') {
      const units = await farmingUnitRepository.findOwnedSummary(user.id);
      farmingUnitIds = units.map((unit) => unit.id);
    }

    const [items, total] = await deviceRepository.list({
      skip,
      take,
      status: query.status,
      farmingUnitIds,
    });
    return { items, meta: pageMeta(query.page, query.limit, total) };
  },

  async getById(user: AuthUser, id: string) {
    const device = await deviceRepository.findById(id);
    if (!device) throw new ApiError(404, 'NOT_FOUND', 'Device not found');
    if (device.farmingUnitId) {
      await requireFarmingUnit(user, device.farmingUnitId, 'read');
    } else if (user.role === 'CUSTOMER') {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this device');
    }
    return device;
  },

  async update(user: AuthUser, id: string, input: UpdateDeviceInput) {
    const device = await this.getById(user, id);
    if (device.farmingUnitId) {
      await requireFarmingUnit(user, device.farmingUnitId, 'operate');
    } else if (user.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this device');
    }
    if (input.status === 'ONLINE' && user.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'Only a device heartbeat can mark a device online');
    }

    return deviceRepository.update(id, {
      ...(input.firmwareVersion !== undefined ? { firmwareVersion: input.firmwareVersion } : {}),
      ...(input.configuration !== undefined ? { configuration: toJson(input.configuration) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
  },

  async rotateKey(user: AuthUser, id: string) {
    const device = await this.getById(user, id);
    if (device.farmingUnitId) await requireFarmingUnit(user, device.farmingUnitId, 'operate');
    const apiKey = generateDeviceKey();
    await deviceRepository.updateApiKeyHash(id, hashDeviceKey(apiKey));
    return { deviceId: id, apiKey };
  },

  async ingestTelemetry(device: DevicePrincipal, input: DeviceTelemetryInput) {
    if (!device.farmingUnitId) {
      throw new ApiError(409, 'NO_DEVICE', 'Device is not linked to a farming unit');
    }
    const reading = await sensorService.create({ device }, input);
    const [commands, current] = await Promise.all([
      commandRepository.listPending(device.id),
      deviceRepository.findById(device.id),
    ]);
    return {
      reading,
      lastSeen: current?.lastSeen ?? null,
      status: current?.status ?? 'ONLINE',
      commands,
    };
  },

  async heartbeat(device: DevicePrincipal, input: HeartbeatInput) {
    const status = input.status ?? 'ONLINE';
    const updated = await deviceRepository.update(device.id, {
      status,
      lastSeen: new Date(),
      ...(input.firmwareVersion !== undefined ? { firmwareVersion: input.firmwareVersion } : {}),
      ...(input.health !== undefined ? { health: toJson(input.health) } : {}),
    });

    if (!device.farmingUnitId) return updated;
    const unit = await farmingUnitRepository.findById(device.farmingUnitId);
    if (!unit) return updated;

    if (status === 'ONLINE' && unit.status === 'OFFLINE') {
      await farmingUnitRepository.update(unit.id, { status: 'ACTIVE' });
    }

    const sensorError = input.health?.sensorError === true;
    const reportedError = status === 'ERROR' || sensorError;
    if (reportedError) {
      const since = new Date(Date.now() - env.ALERT_DEDUPE_MINUTES * 60 * 1000);
      const duplicate = await alertRepository.findRecentDuplicate({
        userId: unit.ownerId,
        farmingUnitId: unit.id,
        type: 'SENSOR_ERROR',
        since,
      });
      if (!duplicate) {
        const detail = typeof input.health?.message === 'string' ? input.health.message : null;
        await alertRepository.create({
          userId: unit.ownerId,
          farmingUnitId: unit.id,
          type: 'SENSOR_ERROR',
          severity: 'WARNING',
          title: 'Device reported an error',
          message: detail ?? 'The device reported an error state.',
        });
      }
    }

    return updated;
  },

  async pendingCommands(device: DevicePrincipal) {
    return commandRepository.listPending(device.id);
  },

  async acknowledge(device: DevicePrincipal, commandId: string, status: 'ACKNOWLEDGED' | 'FAILED') {
    const command = await commandRepository.findById(commandId);
    if (!command || command.deviceId !== device.id) {
      throw new ApiError(404, 'NOT_FOUND', 'Command not found');
    }
    if (command.status !== 'PENDING') {
      throw new ApiError(409, 'CONFLICT', 'Command is no longer pending');
    }
    return commandRepository.acknowledge(commandId, status);
  },
};
