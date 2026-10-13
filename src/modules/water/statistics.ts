import { ApiError } from '../../utils/api-error';
import { daysBetween, getZonedCalendar } from '../../utils/time';

export type WaterTotal = {
  unit: string;
  amountUsed: number;
  readingCount: number;
};

export function toWaterTotals(
  groups: Array<{ unit: string; _sum: { amountUsed: number | null }; _count: { _all: number } }>,
): WaterTotal[] {
  return groups.map((group) => ({
    unit: group.unit,
    amountUsed: group._sum.amountUsed ?? 0,
    readingCount: group._count._all,
  }));
}

export function buildWaterStatistics(params: {
  totals: WaterTotal[];
  from: Date;
  to: Date;
  baselineAmount?: number;
  baselineUnit?: string;
}) {
  const days = daysBetween(params.from, params.to);
  const averagePerDay = params.totals.map((total) => ({
    unit: total.unit,
    amountUsed: total.amountUsed / days,
  }));

  let comparison: {
    unit: string;
    baselineAmount: number;
    recordedAmount: number;
    difference: number;
    note: string;
  } | null = null;

  if (params.baselineAmount !== undefined) {
    const unit =
      params.baselineUnit ?? (params.totals.length === 1 ? params.totals[0]?.unit : undefined);
    if (!unit) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'baselineUnit is required when recorded usage contains more than one unit, or when there are no records',
      );
    }
    const recorded = params.totals.find((total) => total.unit === unit)?.amountUsed ?? 0;
    comparison = {
      unit,
      baselineAmount: params.baselineAmount,
      recordedAmount: recorded,
      difference: params.baselineAmount - recorded,
      note: 'difference is the supplied baseline minus recorded usage for this period. It is not a scientific estimate.',
    };
  }

  return {
    from: params.from,
    to: params.to,
    totals: params.totals,
    averagePerDay,
    comparison,
  };
}

export function bucketWaterByDay(
  records: Array<{ amountUsed: number; unit: string; recordedAt: Date }>,
  timeZone: string,
) {
  const buckets = new Map<string, Map<string, number>>();
  for (const record of records) {
    const parts = getZonedCalendar(record.recordedAt, timeZone);
    const day = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    const units = buckets.get(day) ?? new Map<string, number>();
    units.set(record.unit, (units.get(record.unit) ?? 0) + record.amountUsed);
    buckets.set(day, units);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, units]) => ({
      date,
      totals: [...units.entries()].map(([unit, amountUsed]) => ({ unit, amountUsed })),
    }));
}
