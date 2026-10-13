import { CropStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const cropRepository = {
  create(data: Prisma.CropUncheckedCreateInput) {
    return prisma.crop.create({ data });
  },

  findById(id: string) {
    return prisma.crop.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.CropUpdateInput) {
    return prisma.crop.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.crop.delete({ where: { id } });
  },

  list(params: {
    farmingUnitId: string;
    status?: CropStatus;
    search?: string;
    sort?: 'plantingDate' | 'name' | 'status' | 'createdAt';
    order?: 'asc' | 'desc';
    skip: number;
    take: number;
  }) {
    const where: Prisma.CropWhereInput = {
      farmingUnitId: params.farmingUnitId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? { name: { contains: params.search, mode: 'insensitive' } }
        : {}),
    };
    return prisma.$transaction([
      prisma.crop.findMany({
        where,
        orderBy: { [params.sort ?? 'plantingDate']: params.order ?? 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.crop.count({ where }),
    ]);
  },

  listCurrent(farmingUnitIds: string[]) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.crop.findMany({
      where: {
        farmingUnitId: { in: farmingUnitIds },
        status: { in: ['PLANTED', 'GROWING', 'READY_FOR_HARVEST'] },
      },
      orderBy: { plantingDate: 'desc' },
    });
  },

  countByStatus(farmingUnitId: string) {
    return prisma.crop.groupBy({
      by: ['status'],
      where: { farmingUnitId },
      _count: { _all: true },
    });
  },
};
