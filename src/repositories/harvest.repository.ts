import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const harvestRepository = {
  create(data: Prisma.HarvestUncheckedCreateInput) {
    return prisma.harvest.create({ data });
  },

  findById(id: string) {
    return prisma.harvest.findUnique({ where: { id }, include: { crop: true } });
  },

  list(params: {
    cropId?: string;
    farmingUnitId?: string;
    from?: Date;
    to?: Date;
    sort?: 'harvestDate' | 'quantity' | 'createdAt';
    order?: 'asc' | 'desc';
    skip: number;
    take: number;
  }) {
    const where: Prisma.HarvestWhereInput = {
      ...(params.cropId ? { cropId: params.cropId } : {}),
      ...(params.farmingUnitId ? { crop: { farmingUnitId: params.farmingUnitId } } : {}),
      ...(params.from || params.to
        ? {
            harvestDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lt: params.to } : {}),
            },
          }
        : {}),
    };
    return prisma.$transaction([
      prisma.harvest.findMany({
        where,
        include: { crop: { select: { id: true, name: true, farmingUnitId: true } } },
        orderBy: { [params.sort ?? 'harvestDate']: params.order ?? 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.harvest.count({ where }),
    ]);
  },

  recentForUnits(farmingUnitIds: string[], take: number) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.harvest.findMany({
      where: { crop: { farmingUnitId: { in: farmingUnitIds } } },
      include: { crop: { select: { id: true, name: true, farmingUnitId: true } } },
      orderBy: { harvestDate: 'desc' },
      take,
    });
  },

  sumByUnitForFarmingUnit(farmingUnitId: string) {
    return prisma.harvest.groupBy({
      by: ['unit'],
      where: { crop: { farmingUnitId } },
      _sum: { quantity: true },
      _count: { _all: true },
    });
  },
};
