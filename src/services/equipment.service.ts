import { PowerState, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { isDeviceOnline } from '../modules/devices/presence';
import { commandRepository } from '../repositories/command.repository';
import { deviceRepository } from '../repositories/device.repository';
import { equipmentRepository } from '../repositories/equipment.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import type {
  ControlEquipmentInput,
  CreateEquipmentInput,
  ListEquipmentQuery,
  UpdateEquipmentInput,
} from '../validators/equipment.validator';
import { requireFarmingUnit } from './access.service';

export const equipmentService = {
  async create(user: AuthUser, input: CreateEquipmentInput) {
    await requireFarmingUnit(user, input.farmingUnitId, 'operate');
    const powerState = input.powerState ?? 'OFF';
    if (powerState === 'ON') {
      await assertDeviceCanReceiveCommands(input.farmingUnitId);
    }

    const equipment = await equipmentRepository.create({
      farmingUnitId: input.farmingUnitId,
      name: input.name,
      type: input.type,
      status: input.status ?? 'OFFLINE',
      powerState,
      configuration: input.configuration as Prisma.InputJsonValue | undefined,
    });

    if (powerState === 'ON') {
      const device = await deviceRepository.findByFarmingUnitId(input.farmingUnitId);
      if (device) {
        const command = await commandRepository.create({
          deviceId: device.id,
          equipmentId: equipment.id,
          command: 'SET_POWER',
          payload: { powerState: 'ON', equipmentType: equipment.type, source: 'user' },
          status: 'PENDING',
        });
        return { equipment, command, delivered: true };
      }
    }

    return { equipment, command: null, delivered: powerState !== 'ON' };
  },

  async list(user: AuthUser, query: ListEquipmentQuery) {
    await requireFarmingUnit(user, query.farmingUnitId, 'read');
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'name', query.order, query.sort ? 'desc' : 'asc');
    const [items, total] = await equipmentRepository.listPage({
      farmingUnitId: query.farmingUnitId,
      type: query.type,
      sort: sort.sort as 'name' | 'type' | 'createdAt',
      order: sort.order,
      skip,
      take,
    });
    const device = await deviceRepository.findPublicByFarmingUnitId(query.farmingUnitId);
    const deviceOnline = device ? isDeviceOnline(device) : false;
    return {
      items: items.map((item) => ({ ...item, deviceOnline })),
      meta: { ...pageMeta(query.page, query.limit, total, sort), deviceOnline },
    };
  },

  async getById(user: AuthUser, id: string) {
    const equipment = await equipmentRepository.findById(id);
    if (!equipment) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
    await requireFarmingUnit(user, equipment.farmingUnitId, 'read');
    return equipment;
  },

  async status(user: AuthUser, id: string) {
    const equipment = await this.getById(user, id);
    const device = await deviceRepository.findPublicByFarmingUnitId(equipment.farmingUnitId);
    return {
      id: equipment.id,
      name: equipment.name,
      type: equipment.type,
      status: equipment.status,
      powerState: equipment.powerState,
      configuration: equipment.configuration,
      deviceOnline: device ? isDeviceOnline(device) : false,
      updatedAt: equipment.updatedAt,
    };
  },

  async setPowerByType(user: AuthUser, input: ControlEquipmentInput) {
    await requireFarmingUnit(user, input.farmingUnitId, 'operate');
    const items = await equipmentRepository.findByUnitAndType(input.farmingUnitId, input.type);
    if (items.length === 0) {
      throw new ApiError(
        404,
        'NOT_FOUND',
        `No ${input.type} equipment is registered on this farming unit`,
      );
    }
    const device = await assertDeviceCanReceiveCommands(input.farmingUnitId);

    return prisma.$transaction(async (tx) => {
      const equipment = [];
      const commands = [];
      for (const item of items) {
        const updated = await equipmentRepository.update(
          item.id,
          { powerState: input.powerState },
          tx,
        );
        const command = await commandRepository.create(
          {
            deviceId: device.id,
            equipmentId: item.id,
            command: 'SET_POWER',
            payload: { powerState: input.powerState, equipmentType: item.type, source: 'user' },
            status: 'PENDING',
          },
          tx,
        );
        equipment.push(updated);
        commands.push(command);
      }
      return { equipment, commands, delivered: true as const };
    });
  },

  async setPower(user: AuthUser, id: string, powerState: PowerState) {
    const equipment = await equipmentRepository.findById(id);
    if (!equipment) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
    await requireFarmingUnit(user, equipment.farmingUnitId, 'operate');
    const device = await assertDeviceCanReceiveCommands(equipment.farmingUnitId);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await equipmentRepository.update(id, { powerState }, tx);
      const command = await commandRepository.create(
        {
          deviceId: device.id,
          equipmentId: equipment.id,
          command: 'SET_POWER',
          payload: { powerState, equipmentType: equipment.type, source: 'user' },
          status: 'PENDING',
        },
        tx,
      );
      return { equipment: updated, command, delivered: true };
    });

    return result;
  },

  async update(user: AuthUser, id: string, input: UpdateEquipmentInput) {
    const equipment = await equipmentRepository.findById(id);
    if (!equipment) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
    await requireFarmingUnit(user, equipment.farmingUnitId, 'operate');

    const updated = await equipmentRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.configuration !== undefined
        ? { configuration: input.configuration as Prisma.InputJsonValue }
        : {}),
    });

    if (input.configuration === undefined) {
      return { equipment: updated, command: null, delivered: true };
    }

    const device = await deviceRepository.findByFarmingUnitId(equipment.farmingUnitId);
    if (!device || !isDeviceOnline(device)) {
      return { equipment: updated, command: null, delivered: false };
    }

    const command = await commandRepository.create({
      deviceId: device.id,
      equipmentId: equipment.id,
      command: 'UPDATE_CONFIG',
      payload: {
        configuration: input.configuration,
        source: 'user',
      },
      status: 'PENDING',
    });
    return { equipment: updated, command, delivered: true };
  },
};

async function assertDeviceCanReceiveCommands(farmingUnitId: string) {
  const device = await deviceRepository.findByFarmingUnitId(farmingUnitId);
  if (!device) {
    throw new ApiError(409, 'NO_DEVICE', 'This farming unit has no registered device');
  }
  if (!isDeviceOnline(device)) {
    throw new ApiError(
      409,
      'DEVICE_OFFLINE',
      'The device is offline, so the equipment command was not applied.',
    );
  }
  return device;
}
