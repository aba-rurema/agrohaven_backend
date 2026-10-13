import { env } from '../config/env';

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function readParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts: Partial<Record<string, string>> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = readParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  timeZone = env.TIMEZONE,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = utcGuess - zoneOffsetMs(new Date(utcGuess), timeZone);
  instant = utcGuess - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

export function getZonedCalendar(date: Date, timeZone = env.TIMEZONE): DateParts {
  return readParts(date, timeZone);
}

export function getZonedWeekday(date: Date, timeZone = env.TIMEZONE): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return weekdayIndex[label] ?? 0;
}

export function parseDateOnly(value: string, timeZone = env.TIMEZONE): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error('Invalid date');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = zonedDateTimeToUtc(year, month, day, 0, 0, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  const end = zonedDateTimeToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    timeZone,
  );
  return { start, end };
}

export function startOfZonedDay(date: Date, timeZone = env.TIMEZONE): Date {
  const parts = readParts(date, timeZone);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timeZone);
}

export function addZonedDays(
  year: number,
  month: number,
  day: number,
  days: number,
): {
  year: number;
  month: number;
  day: number;
} {
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function zonedWeekRange(date: Date, timeZone = env.TIMEZONE): { start: Date; end: Date } {
  const parts = readParts(date, timeZone);
  const weekday = getZonedWeekday(date, timeZone);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addZonedDays(parts.year, parts.month, parts.day, mondayOffset);
  const nextMonday = addZonedDays(monday.year, monday.month, monday.day, 7);
  return {
    start: zonedDateTimeToUtc(monday.year, monday.month, monday.day, 0, 0, timeZone),
    end: zonedDateTimeToUtc(nextMonday.year, nextMonday.month, nextMonday.day, 0, 0, timeZone),
  };
}

export function zonedMonthRange(
  year: number,
  month: number,
  timeZone = env.TIMEZONE,
): { start: Date; end: Date } {
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: zonedDateTimeToUtc(year, month, 1, 0, 0, timeZone),
    end: zonedDateTimeToUtc(nextMonth.year, nextMonth.month, 1, 0, 0, timeZone),
  };
}

export function formatHm(date: Date, timeZone = env.TIMEZONE): string {
  const parts = readParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function isWithinTimeWindow(current: string, start: string, end: string): boolean {
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function daysBetween(start: Date, end: Date): number {
  const ms = Math.max(end.getTime() - start.getTime(), 0);
  return Math.max(ms / (24 * 60 * 60 * 1000), 1 / 24);
}
