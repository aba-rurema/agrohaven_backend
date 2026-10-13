import { env } from '../config/env';
import { bucketWaterByDay, buildWaterStatistics, toWaterTotals } from '../modules/water/statistics';
import { waterUsageRepository } from '../repositories/water-usage.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import { getZonedCalendar, parseDateOnly, zonedMonthRange } from '../utils/time';
import type {
  CreateWaterUsageInput,
  WaterHistoryQuery,
  WaterStatisticsQuery,
} from '../validators/water-usage.validator';
import { requireFarmingUnit } from './access.service';

export const waterUsageService = {
  async create(user: AuthUser, input: CreateWaterUsageInput) {
    await requireFarmingUnit(user, input.farmingUnitId, 'operate');
    return waterUsageRepository.create({
      farmingUnitId: input.farmingUnitId,
      amountUsed: input.amountUsed,
      unit: input.unit,
      recordedAt: input.recordedAt ?? new Date(),
    });
  },

  async history(user: AuthUser, query: WaterHistoryQuery) {
    await requireFarmingUnit(user, query.farmingUnitId, 'read');
    if (query.from && query.to && query.from >= query.to) {
      throw new ApiError(400, 'VALIDATION_ERROR', '`from` must be earlier than `to`');
    }
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'recordedAt', query.order);
    const [items, total] = await waterUsageRepository.list({
      farmingUnitId: query.farmingUnitId,
      from: query.from,
      to: query.to,
      sort: sort.sort as 'recordedAt' | 'amountUsed',
      order: sort.order,
      skip,
      take,
    });
    return { items, meta: pageMeta(query.page, query.limit, total, sort) };
  },

  async daily(user: AuthUser, farmingUnitId: string, date?: string) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const day = date ?? formatToday();
    const range = parseDateOnly(day);
    const totals = toWaterTotals(
      await waterUsageRepository.totals(farmingUnitId, range.start, range.end),
    );
    return { date: day, from: range.start, to: range.end, totals };
  },

  async monthly(user: AuthUser, farmingUnitId: string, year?: number, month?: number) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const today = getZonedCalendar(new Date());
    const selectedYear = year ?? today.year;
    const selectedMonth = month ?? today.month;
    const range = zonedMonthRange(selectedYear, selectedMonth);
    const [groups, records] = await Promise.all([
      waterUsageRepository.totals(farmingUnitId, range.start, range.end),
      waterUsageRepository.recordsInRange([farmingUnitId], range.start, range.end),
    ]);
    return {
      year: selectedYear,
      month: selectedMonth,
      from: range.start,
      to: range.end,
      totals: toWaterTotals(groups),
      daily: bucketWaterByDay(records, env.TIMEZONE),
    };
  },

  async total(user: AuthUser, query: WaterStatisticsQuery) {
    await requireFarmingUnit(user, query.farmingUnitId, 'read');
    if (query.from && query.to && query.from >= query.to) {
      throw new ApiError(400, 'VALIDATION_ERROR', '`from` must be earlier than `to`');
    }
    const totals = toWaterTotals(
      await waterUsageRepository.totals(query.farmingUnitId, query.from, query.to),
    );
    return { from: query.from ?? null, to: query.to ?? null, totals };
  },

  async statistics(user: AuthUser, query: WaterStatisticsQuery) {
    await requireFarmingUnit(user, query.farmingUnitId, 'read');
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (from >= to) throw new ApiError(400, 'VALIDATION_ERROR', '`from` must be earlier than `to`');
    const totals = toWaterTotals(await waterUsageRepository.totals(query.farmingUnitId, from, to));
    return buildWaterStatistics({
      totals,
      from,
      to,
      baselineAmount: query.baselineAmount,
      baselineUnit: query.baselineUnit,
    });
  },
};

function formatToday(): string {
  const parts = getZonedCalendar(new Date());
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
