import { FarmingUnitStatus, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../config/prisma';

export const farmingUnitRepository = {
  create(data: Prisma.FarmingUnitUncheckedCreateInput, db: DbClient = prisma) {
    return db.farmingUnit.create({ data });
  },

  findById(id: string, db: DbClient = prisma) {
    return db.farmingUnit.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.FarmingUnitUpdateInput, db: DbClient = prisma) {
    return db.farmingUnit.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.farmingUnit.delete({ where: { id } });
  },

  list(params: {
    skip: number;
    take: number;
    ownerId?: string;
    status?: FarmingUnitStatus;
    search?: string;
    sort?: 'createdAt' | 'name' | 'status';
    order?: 'asc' | 'desc';
  }) {
    const where: Prisma.FarmingUnitWhereInput = {
      ...(params.ownerId ? { ownerId: params.ownerId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { location: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prisma.$transaction([
      prisma.farmingUnit.findMany({
        where,
        orderBy: { [params.sort ?? 'createdAt']: params.order ?? 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          device: {
            select: {
              id: true,
              deviceIdentifier: true,
              status: true,
              lastSeen: true,
              firmwareVersion: true,
            },
          },
        },
      }),
      prisma.farmingUnit.count({ where }),
    ]);
  },

  countByOwner(ownerId: string) {
    return prisma.farmingUnit.count({ where: { ownerId } });
  },

  countByStatusForOwner(ownerId: string, status: FarmingUnitStatus) {
    return prisma.farmingUnit.count({ where: { ownerId, status } });
  },

  countAll() {
    return prisma.farmingUnit.count();
  },

  countByStatus() {
    return prisma.farmingUnit.groupBy({ by: ['status'], _count: { _all: true } });
  },

  findOwnedSummary(ownerId: string) {
    return prisma.farmingUnit.findMany({
      where: { ownerId },
      select: { id: true, name: true, status: true, location: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};
