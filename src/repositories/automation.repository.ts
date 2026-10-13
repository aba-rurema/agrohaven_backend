import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const automationRepository = {
  create(data: Prisma.AutomationUncheckedCreateInput) {
    return prisma.automation.create({ data });
  },

  findById(id: string) {
    return prisma.automation.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.AutomationUpdateInput) {
    return prisma.automation.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.automation.delete({ where: { id } });
  },

  listByUnit(farmingUnitId: string) {
    return prisma.automation.findMany({
      where: { farmingUnitId },
      orderBy: { createdAt: 'desc' },
    });
  },

  listEnabledForUnit(farmingUnitId: string) {
    return prisma.automation.findMany({
      where: { farmingUnitId, enabled: true },
    });
  },

  listEnabledByType(type: 'THRESHOLD' | 'SCHEDULE' | 'ALERT') {
    return prisma.automation.findMany({
      where: { enabled: true, type },
      include: { farmingUnit: { select: { id: true, ownerId: true, status: true } } },
    });
  },
};
