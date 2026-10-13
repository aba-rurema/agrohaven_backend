import { alertRepository } from '../repositories/alert.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import type { ListAlertsQuery } from '../validators/alert.validator';
import { requireFarmingUnit } from './access.service';

export const alertService = {
  async list(user: AuthUser, query: ListAlertsQuery, unreadOnly = false) {
    if (query.farmingUnitId) await requireFarmingUnit(user, query.farmingUnitId, 'read');
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'createdAt', query.order);
    const [items, total] = await alertRepository.list({
      userId: user.role === 'ADMIN' ? undefined : user.id,
      farmingUnitId: query.farmingUnitId,
      isRead: unreadOnly ? false : query.isRead,
      type: query.type,
      severity: query.severity,
      sort: sort.sort as 'createdAt' | 'severity',
      order: sort.order,
      skip,
      take,
    });

    return { items, meta: pageMeta(query.page, query.limit, total, sort) };
  },

  async summary(user: AuthUser) {
    const [unread, grouped] = await Promise.all([
      alertRepository.countUnread(user.id),
      alertRepository.countUnreadBySeverity(user.id),
    ]);
    const bySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 };
    for (const row of grouped) bySeverity[row.severity] = row._count._all;
    return { unread, bySeverity };
  },

  async markRead(user: AuthUser, id: string) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new ApiError(404, 'NOT_FOUND', 'Alert not found');
    if (alert.userId !== user.id && user.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this alert');
    }
    return alertRepository.markRead(id);
  },

  async markAllRead(user: AuthUser) {
    const result = await alertRepository.markAllRead(user.id);
    return { updated: result.count };
  },

  async remove(user: AuthUser, id: string) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new ApiError(404, 'NOT_FOUND', 'Alert not found');
    if (alert.userId !== user.id && user.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this alert');
    }
    await alertRepository.delete(id);
  },
};
