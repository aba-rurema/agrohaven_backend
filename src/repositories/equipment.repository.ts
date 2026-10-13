import { EquipmentType, Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../config/prisma';

export const equipmentRepository = {
  create(data: Prisma.EquipmentUncheckedCreateInput) {
    return prisma.equipment.create({ data });
  },

  findById(id: string) {
    return prisma.equipment.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.EquipmentUpdateInput, db: DbClient = prisma) {
    return db.equipment.update({ where: { id }, data });
  },

  listPage(params: {
    farmingUnitId: string;
    type?: EquipmentType;
    sort?: 'name' | 'type' | 'createdAt';
    order?: 'asc' | 'desc';
    skip: number;
    take: number;
  }) {
    const where: Prisma.EquipmentWhereInput = {
      farmingUnitId: params.farmingUnitId,
      ...(params.type ? { type: params.type } : {}),
    };
    return prisma.$transaction([
      prisma.equipment.findMany({
        where,
        orderBy: { [params.sort ?? 'name']: params.order ?? 'asc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.equipment.count({ where }),
    ]);
  },

  listByUnit(farmingUnitId: string) {
    return prisma.equipment.findMany({
      where: { farmingUnitId },
      orderBy: { createdAt: 'asc' },
    });
  },

  listByUnits(farmingUnitIds: string[]) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.equipment.findMany({
      where: { farmingUnitId: { in: farmingUnitIds } },
      orderBy: { createdAt: 'asc' },
    });
  },

  findByUnitAndType(farmingUnitId: string, type: EquipmentType) {
    return prisma.equipment.findMany({ where: { farmingUnitId, type } });
  },
};
