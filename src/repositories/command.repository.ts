import { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '../config/prisma';

export const commandRepository = {
  create(data: Prisma.DeviceCommandUncheckedCreateInput, db: DbClient = prisma) {
    return db.deviceCommand.create({ data });
  },

  listPending(deviceId: string) {
    return prisma.deviceCommand.findMany({
      where: { deviceId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  },

  findById(id: string) {
    return prisma.deviceCommand.findUnique({ where: { id } });
  },

  acknowledge(id: string, status: 'ACKNOWLEDGED' | 'FAILED') {
    return prisma.deviceCommand.update({
      where: { id },
      data: { status, acknowledgedAt: new Date() },
    });
  },
};
