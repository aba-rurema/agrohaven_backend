import { env } from '../config/env';
import { farmingUnitRepository } from '../repositories/farming-unit.repository';
import { deviceRepository } from '../repositories/device.repository';
import { alertRepository } from '../repositories/alert.repository';
import { cropRepository } from '../repositories/crop.repository';
import { equipmentRepository } from '../repositories/equipment.repository';
import { sensorRepository } from '../repositories/sensor.repository';
import { userRepository } from '../repositories/user.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import { isDeviceOnline } from '../modules/devices/presence';
import type {
  CreateFarmingUnitInput,
  ListFarmingUnitsQuery,
  UpdateFarmingUnitInput,
} from '../validators/farming-unit.validator';
import { requireFarmingUnit } from './access.service';
import type { FarmingUnitStatus } from '@prisma/client';

export const farmingUnitService = {
  async create(user: AuthUser, input: CreateFarmingUnitInput) {
    if (input.ownerId && user.role === 'CUSTOMER') {
      throw new ApiError(403, 'FORBIDDEN', 'You cannot assign a farming unit to another user');
    }
    if (!input.ownerId && user.role === 'TECHNICIAN') {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Technicians must set ownerId when creating a farming unit',
      );
    }

    const ownerId = input.ownerId ?? user.id;
    if (input.ownerId) {
      const owner = await userRepository.findPublicById(input.ownerId);
      if (!owner || !owner.isActive) throw new ApiError(404, 'NOT_FOUND', 'Owner not found');
    }

    return farmingUnitRepository.create({
      name: input.name,
      location: input.location,
      ownerId,
      deviceId: input.deviceId,
      installationDate: input.installationDate,
      status: input.status ?? 'INACTIVE',
    });
  },

  async list(user: AuthUser, query: ListFarmingUnitsQuery) {
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'createdAt', query.order);
    const [items, total] = await farmingUnitRepository.list({
      skip,
      take,
      ownerId: user.role === 'CUSTOMER' ? user.id : undefined,
      status: query.status,
      search: query.search,
      sort: sort.sort as 'createdAt' | 'name' | 'status',
      order: sort.order,
    });
    return {
      items: items.map((unit) => ({
        ...unit,
        device: unit.device
          ? { ...unit.device, online: isDeviceOnline(unit.device) }
          : null,
      })),
      meta: pageMeta(query.page, query.limit, total, sort),
    };
  },

  async getById(user: AuthUser, id: string) {
    return requireFarmingUnit(user, id, 'read');
  },

  async overview(user: AuthUser, id: string) {
    const unit = await requireFarmingUnit(user, id, 'read');
    const alertUserId = user.role === 'ADMIN' ? undefined : user.id;
    const [device, latestReading, equipment, crops, cropCounts, alerts] = await Promise.all([
      deviceRepository.findPublicByFarmingUnitId(id),
      sensorRepository.latest(id),
      equipmentRepository.listByUnit(id),
      cropRepository.list({ farmingUnitId: id, skip: 0, take: 20 }),
      cropRepository.countByStatus(id),
      alertRepository.list({
        userId: alertUserId,
        farmingUnitId: id,
        isRead: false,
        skip: 0,
        take: 5,
      }),
    ]);
    const online = device ? isDeviceOnline(device) : false;
    const byStatus = { PLANTED: 0, GROWING: 0, READY_FOR_HARVEST: 0, HARVESTED: 0, FAILED: 0 };
    for (const row of cropCounts) byStatus[row.status] = row._count._all;

    return {
      unit,
      device: device ? { ...device, online } : null,
      latestReading,
      equipment: equipment.map((item) => ({ ...item, deviceOnline: online })),
      crops: {
        items: crops[0],
        meta: pageMeta(1, 20, crops[1], { sort: 'plantingDate', order: 'desc' }),
        byStatus,
      },
      alerts: {
        unread: alerts[1],
        recent: alerts[0],
      },
    };
  },

  async update(user: AuthUser, id: string, input: UpdateFarmingUnitInput) {
    const unit = await requireFarmingUnit(user, id, 'manage');
    if (input.deviceId !== undefined) {
      const device = await deviceRepository.findByFarmingUnitId(unit.id);
      if (device && input.deviceId !== device.deviceIdentifier) {
        throw new ApiError(
          409,
          'DEVICE_MISMATCH',
          'Unlink the registered device before changing the hardware id',
        );
      }
    }

    return farmingUnitRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
      ...(input.installationDate !== undefined ? { installationDate: input.installationDate } : {}),
    });
  },

  async remove(user: AuthUser, id: string) {
    await requireFarmingUnit(user, id, 'manage');
    await farmingUnitRepository.delete(id);
  },

  async assign(id: string, userId: string) {
    const unit = await farmingUnitRepository.findById(id);
    if (!unit) throw new ApiError(404, 'NOT_FOUND', 'Farming unit not found');
    const owner = await userRepository.findPublicById(userId);
    if (!owner || !owner.isActive) throw new ApiError(404, 'NOT_FOUND', 'User not found');
    return farmingUnitRepository.update(id, { owner: { connect: { id: owner.id } } });
  },

  async changeStatus(user: AuthUser, id: string, status: FarmingUnitStatus) {
    const unit = await requireFarmingUnit(
      user,
      id,
      user.role === 'TECHNICIAN' ? 'operate' : 'manage',
    );
    const updated = await farmingUnitRepository.update(id, { status });
    if (status === 'MAINTENANCE') {
      const since = new Date(Date.now() - env.ALERT_DEDUPE_MINUTES * 60 * 1000);
      const duplicate = await alertRepository.findRecentDuplicate({
        userId: unit.ownerId,
        farmingUnitId: unit.id,
        type: 'MAINTENANCE_REQUIRED',
        since,
      });
      if (!duplicate) {
        await alertRepository.create({
          userId: unit.ownerId,
          farmingUnitId: unit.id,
          type: 'MAINTENANCE_REQUIRED',
          severity: 'INFO',
          title: 'Maintenance required',
          message: `${unit.name} was marked for maintenance.`,
        });
      }
    }
    return updated;
  },
};
