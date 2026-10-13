import { DeviceStatus, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../config/prisma';

const devicePublicSelect = {
  id: true,
  deviceIdentifier: true,
  farmingUnitId: true,
  status: true,
  lastSeen: true,
  firmwareVersion: true,
  health: true,
  configuration: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeviceSelect;

export const deviceRepository = {
  create(data: Prisma.DeviceUncheckedCreateInput, db: DbClient = prisma) {
    return db.device.create({ data, select: devicePublicSelect });
  },

  findById(id: string) {
    return prisma.device.findUnique({ where: { id }, select: devicePublicSelect });
  },

  findByIdentifier(deviceIdentifier: string) {
    return prisma.device.findUnique({ where: { deviceIdentifier } });
  },

  findByFarmingUnitId(farmingUnitId: string) {
    return prisma.device.findUnique({ where: { farmingUnitId } });
  },

  findPublicByFarmingUnitId(farmingUnitId: string) {
    return prisma.device.findUnique({ where: { farmingUnitId }, select: devicePublicSelect });
  },

  updateApiKeyHash(id: string, apiKeyHash: string) {
    return prisma.device.update({ where: { id }, data: { apiKeyHash }, select: { id: true } });
  },

  update(id: string, data: Prisma.DeviceUpdateInput, db: DbClient = prisma) {
    return db.device.update({ where: { id }, data, select: devicePublicSelect });
  },

  list(params: { skip: number; take: number; farmingUnitIds?: string[]; status?: DeviceStatus }) {
    const where: Prisma.DeviceWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.farmingUnitIds ? { farmingUnitId: { in: params.farmingUnitIds } } : {}),
    };

    return prisma.$transaction([
      prisma.device.findMany({
        where,
        select: devicePublicSelect,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.device.count({ where }),
    ]);
  },

  findStaleOnline(cutoff: Date) {
    return prisma.device.findMany({
      where: {
        status: 'ONLINE',
        OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }],
      },
      include: { farmingUnit: { select: { id: true, ownerId: true, status: true } } },
    });
  },

  countAll() {
    return prisma.device.count();
  },

  countByStatus() {
    return prisma.device.groupBy({ by: ['status'], _count: { _all: true } });
  },
};
