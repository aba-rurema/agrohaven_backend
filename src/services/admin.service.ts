import { env } from '../config/env';
import { summarizeSensorPeriod } from '../modules/sensors/statistics';
import { toWaterTotals } from '../modules/water/statistics';
import { alertRepository } from '../repositories/alert.repository';
import { deviceRepository } from '../repositories/device.repository';
import { farmingUnitRepository } from '../repositories/farming-unit.repository';
import { sensorRepository } from '../repositories/sensor.repository';
import { userRepository } from '../repositories/user.repository';
import { waterUsageRepository } from '../repositories/water-usage.repository';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import { hashPassword } from '../utils/password';
import { toPublicUser } from '../utils/mappers';
import type { AdminCreateUserInput, AdminUserListQuery } from '../validators/admin.validator';
import type { ListAlertsQuery } from '../validators/alert.validator';
import type { ListDevicesQuery } from '../validators/device.validator';
import type { ListFarmingUnitsQuery } from '../validators/farming-unit.validator';

export const adminService = {
  async listUsers(query: AdminUserListQuery) {
    const { skip, take } = getPagination(query.page, query.limit);
    const [items, total] = await userRepository.list({
      skip,
      take,
      role: query.role,
      search: query.search,
      isActive: query.isActive,
    });
    return { items: items.map(toPublicUser), meta: pageMeta(query.page, query.limit, total) };
  },

  async createUser(input: AdminCreateUserInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
    const user = await userRepository.create({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: await hashPassword(input.password),
      role: input.role,
      location: input.location,
    });
    return toPublicUser(user);
  },

  async setActivation(actorId: string, userId: string, isActive: boolean) {
    if (actorId === userId && !isActive) {
      throw new ApiError(409, 'CONFLICT', 'You cannot deactivate your own account');
    }
    const user = await userRepository.findPublicById(userId);
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
    if (!isActive && user.role === 'ADMIN') {
      const remaining = await userRepository.countActiveAdmins(userId);
      if (remaining === 0) {
        throw new ApiError(409, 'CONFLICT', 'At least one active administrator is required');
      }
    }
    return userRepository.setActive(userId, isActive);
  },

  async listFarmingUnits(query: ListFarmingUnitsQuery) {
    const { skip, take } = getPagination(query.page, query.limit);
    const [items, total] = await farmingUnitRepository.list({
      skip,
      take,
      status: query.status,
      search: query.search,
    });
    return { items, meta: pageMeta(query.page, query.limit, total) };
  },

  async listDevices(query: ListDevicesQuery) {
    const { skip, take } = getPagination(query.page, query.limit);
    const [items, total] = await deviceRepository.list({
      skip,
      take,
      status: query.status,
      farmingUnitIds: query.farmingUnitId ? [query.farmingUnitId] : undefined,
    });
    return { items, meta: pageMeta(query.page, query.limit, total) };
  },

  async listAlerts(query: ListAlertsQuery) {
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'createdAt', query.order);
    const [items, total] = await alertRepository.list({
      farmingUnitId: query.farmingUnitId,
      type: query.type,
      severity: query.severity,
      isRead: query.isRead,
      sort: sort.sort as 'createdAt' | 'severity',
      order: sort.order,
      skip,
      take,
    });
    return { items, meta: pageMeta(query.page, query.limit, total, sort) };
  },

  async sensorStatistics(from?: Date, to?: Date) {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (start >= end)
      throw new ApiError(400, 'VALIDATION_ERROR', '`from` must be earlier than `to`');
    return summarizeSensorPeriod({ from: start, to: end });
  },

  async statistics() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [
      users,
      activeUsers,
      usersByRole,
      units,
      unitsByStatus,
      devices,
      devicesByStatus,
      alerts,
      unreadAlerts,
      readings24h,
      readings7d,
    ] = await Promise.all([
      userRepository.countAll(),
      userRepository.countActive(),
      userRepository.countByRole(),
      farmingUnitRepository.countAll(),
      farmingUnitRepository.countByStatus(),
      deviceRepository.countAll(),
      deviceRepository.countByStatus(),
      alertRepository.countAll(),
      alertRepository.countAllUnread(),
      sensorRepository.countSince(dayAgo),
      sensorRepository.countSince(weekAgo),
    ]);

    const waterGroups = await waterUsageRepository.totalsAll();

    return {
      generatedAt: now.toISOString(),
      timezone: env.TIMEZONE,
      users: {
        total: users,
        active: activeUsers,
        byRole: Object.fromEntries(usersByRole.map((row) => [row.role, row._count._all])),
      },
      farmingUnits: {
        total: units,
        byStatus: Object.fromEntries(unitsByStatus.map((row) => [row.status, row._count._all])),
      },
      devices: {
        total: devices,
        byStatus: Object.fromEntries(devicesByStatus.map((row) => [row.status, row._count._all])),
      },
      alerts: { total: alerts, unread: unreadAlerts },
      sensorReadings: { last24Hours: readings24h, last7Days: readings7d },
      waterUsage: toWaterTotals(waterGroups),
    };
  },
};
