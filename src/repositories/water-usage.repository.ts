import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const waterUsageRepository = {
  create(data: Prisma.WaterUsageUncheckedCreateInput) {
    return prisma.waterUsage.create({ data });
  },

  list(params: {
    farmingUnitId: string;
    from?: Date;
    to?: Date;
    sort?: 'recordedAt' | 'amountUsed';
    order?: 'asc' | 'desc';
    skip: number;
    take: number;
  }) {
    const where: Prisma.WaterUsageWhereInput = {
      farmingUnitId: params.farmingUnitId,
      ...(params.from || params.to
        ? {
            recordedAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lt: params.to } : {}),
            },
          }
        : {}),
    };

    return prisma.$transaction([
      prisma.waterUsage.findMany({
        where,
        orderBy: { [params.sort ?? 'recordedAt']: params.order ?? 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.waterUsage.count({ where }),
    ]);
  },

  totals(farmingUnitId: string, from?: Date, to?: Date) {
    return prisma.waterUsage.groupBy({
      by: ['unit'],
      where: {
        farmingUnitId,
        ...(from || to
          ? {
              recordedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      _sum: { amountUsed: true },
      _count: { _all: true },
    });
  },

  totalsAll() {
    return prisma.waterUsage.groupBy({
      by: ['unit'],
      _sum: { amountUsed: true },
      _count: { _all: true },
    });
  },

  totalsForUnits(farmingUnitIds: string[], from?: Date, to?: Date) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.waterUsage.groupBy({
      by: ['unit'],
      where: {
        farmingUnitId: { in: farmingUnitIds },
        ...(from || to
          ? {
              recordedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      _sum: { amountUsed: true },
      _count: { _all: true },
    });
  },

  recordsInRange(farmingUnitIds: string[], from: Date, to: Date) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.waterUsage.findMany({
      where: {
        farmingUnitId: { in: farmingUnitIds },
        recordedAt: { gte: from, lt: to },
      },
      select: { farmingUnitId: true, amountUsed: true, unit: true, recordedAt: true },
    });
  },
};
