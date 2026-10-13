import { AlertSeverity, AlertType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const alertRepository = {
  create(data: Prisma.AlertUncheckedCreateInput) {
    return prisma.alert.create({ data });
  },

  findRecentDuplicate(params: {
    userId: string;
    farmingUnitId?: string | null;
    type: AlertType;
    since: Date;
  }) {
    return prisma.alert.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        createdAt: { gte: params.since },
        ...(params.farmingUnitId ? { farmingUnitId: params.farmingUnitId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string) {
    return prisma.alert.findUnique({ where: { id } });
  },

  list(params: {
    userId?: string;
    farmingUnitId?: string;
    isRead?: boolean;
    type?: AlertType;
    severity?: AlertSeverity;
    sort?: 'createdAt' | 'severity';
    order?: 'asc' | 'desc';
    skip: number;
    take: number;
  }) {
    const where: Prisma.AlertWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.farmingUnitId ? { farmingUnitId: params.farmingUnitId } : {}),
      ...(params.isRead !== undefined ? { isRead: params.isRead } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
    };

    return prisma.$transaction([
      prisma.alert.findMany({
        where,
        orderBy: { [params.sort ?? 'createdAt']: params.order ?? 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.alert.count({ where }),
    ]);
  },

  markRead(id: string) {
    return prisma.alert.update({ where: { id }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.alert.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  },

  delete(id: string) {
    return prisma.alert.delete({ where: { id } });
  },

  countUnread(userId: string) {
    return prisma.alert.count({ where: { userId, isRead: false } });
  },

  countUnreadBySeverity(userId: string) {
    return prisma.alert.groupBy({
      by: ['severity'],
      where: { userId, isRead: false },
      _count: { _all: true },
    });
  },

  countUnreadByUnits(userId: string, farmingUnitIds: string[]) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.alert.groupBy({
      by: ['farmingUnitId'],
      where: { userId, isRead: false, farmingUnitId: { in: farmingUnitIds } },
      _count: { _all: true },
    });
  },

  countAll() {
    return prisma.alert.count();
  },

  countAllUnread() {
    return prisma.alert.count({ where: { isRead: false } });
  },
};
