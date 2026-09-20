/**
 * Pixel scale and calendar maths for the timeline.
 *
 * Everything here is pure: a day key (`YYYY-MM-DD`) plus a pixels-per-day value is all the
 * geometry the Gantt needs. Zoom is a real change of `pxPerDay`, so a one-day task is always
 * exactly one day wide.
 */
import { differenceInCalendarDays, addDays, getDay, startOfMonth, startOfWeek } from 'date-fns';
import { dayKey, parseDay } from '../../services/export/common';

/** Zoom presets. Each one is a pixels-per-day value, not a tick count. */
export type TimelineZoom = 'day' | 'week' | 'month';

/** Width of one calendar day at each zoom level, in CSS pixels. */
export const ZOOM_PX_PER_DAY: Readonly<Record<TimelineZoom, number>> = {
  day: 34,
  week: 13,
  month: 5,
};

/** Human label of each zoom preset. */
export const ZOOM_LABELS: Readonly<Record<TimelineZoom, string>> = {
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
};

/** Locale used when the browser exposes none (SSR, tests, locked-down runtimes). */
export const FALLBACK_LOCALE = 'en-GB';

/** The browser's locale, or {@link FALLBACK_LOCALE}. Used for every date label in the timeline. */
export function resolveLocale(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale || FALLBACK_LOCALE;
  } catch {
    return FALLBACK_LOCALE;
  }
}

/** Calendar days from `fromKey` to `toKey` (negative when `toKey` is earlier); `null` on bad input. */
export function daysBetween(fromKey: string, toKey: string): number | null {
  const a = parseDay(fromKey);
  const b = parseDay(toKey);
  if (!a || !b) return null;
  return differenceInCalendarDays(b, a);
}

/** `key` moved by `days` calendar days; `null` when `key` is not a day. */
export function shiftDay(key: string, days: number): string | null {
  const d = parseDay(key);
  if (!d || !Number.isFinite(days)) return null;
  return dayKey(addDays(d, Math.trunc(days)));
}

/** Left offset in pixels of a day inside a grid starting at `fromKey`. */
export function xForDay(key: string, fromKey: string, pxPerDay: number): number | null {
  const diff = daysBetween(fromKey, key);
  return diff === null ? null : diff * pxPerDay;
}

/** The day under an x offset (pixels from the left edge of the grid). Floors to whole days. */
export function dayAtX(x: number, fromKey: string, pxPerDay: number): string | null {
  if (!Number.isFinite(x) || pxPerDay <= 0) return null;
  return shiftDay(fromKey, Math.floor(x / pxPerDay));
}

/** `left`/`width` of an inclusive `[start, end]` bar. A single day is exactly one day wide. */
export function barGeometry(
  start: string,
  end: string,
  fromKey: string,
  pxPerDay: number
): { left: number; width: number } | null {
  const left = xForDay(start, fromKey, pxPerDay);
  const span = daysBetween(start, end);
  if (left === null || span === null) return null;
  return { left, width: (Math.max(0, span) + 1) * pxPerDay };
}

/** Total width in pixels of the inclusive range `[fromKey, toKey]`. */
export function rangeWidth(fromKey: string, toKey: string, pxPerDay: number): number {
  const span = daysBetween(fromKey, toKey);
  return span === null ? 0 : (Math.max(0, span) + 1) * pxPerDay;
}

/**
 * Whole days a pointer moved `dx` pixels represents. Snapping happens here, nowhere else, and
 * is symmetric around zero (half a day rounds away from the origin in both directions).
 */
export function deltaDaysFromPx(dx: number, pxPerDay: number): number {
  if (!Number.isFinite(dx) || pxPerDay <= 0) return 0;
  const days = Math.round(Math.abs(dx) / pxPerDay);
  if (days === 0) return 0;
  return dx < 0 ? -days : days;
}

/** An inclusive day interval. */
export interface DayInterval {
  start: string;
  end: string;
}

/** Both ends moved by `days`; returns the input unchanged when a date is unparseable. */
export function moveInterval(interval: DayInterval, days: number): DayInterval {
  const start = shiftDay(interval.start, days);
  const end = shiftDay(interval.end, days);
  return start && end ? { start, end } : interval;
}

/**
 * One edge moved by `days`, the interval clamped to a minimum of one day: dragging the start
 * past the end parks it on the end, and vice versa.
 */
export function resizeInterval(interval: DayInterval, days: number, edge: 'start' | 'end'): DayInterval {
  if (edge === 'start') {
    const start = shiftDay(interval.start, days);
    if (!start || !parseDay(interval.end)) return interval;
    return { start: start > interval.end ? interval.end : start, end: interval.end };
  }
  const end = shiftDay(interval.end, days);
  if (!end || !parseDay(interval.start)) return interval;
  return { start: interval.start, end: end < interval.start ? interval.start : end };
}

/** Formats a day key with `Intl`; invalid input comes back as the raw string. */
export function formatDay(key: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const d = parseDay(key);
  if (!d) return key;
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return key;
  }
}

/** `1 Mar – 4 Mar` style label for a bar tooltip. */
export function formatDayRange(start: string, end: string, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return start === end
    ? formatDay(start, locale, opts)
    : `${formatDay(start, locale, opts)} – ${formatDay(end, locale, opts)}`;
}

/** One label on the time axis. */
export interface AxisTick {
  /** Day key the tick sits on. */
  key: string;
  /** Localised label. */
  label: string;
  /** Left offset in pixels. */
  x: number;
  /** Saturday or Sunday (only meaningful at day zoom). */
  isWeekend: boolean;
}

/**
 * Axis ticks for the visible range: one per day at day zoom, one per Monday at week zoom, one
 * per month at month zoom. The first column always carries a tick so the axis is never blank.
 */
export function axisTicks(
  fromKey: string,
  toKey: string,
  zoom: TimelineZoom,
  pxPerDay: number,
  locale: string
): AxisTick[] {
  const from = parseDay(fromKey);
  const to = parseDay(toKey);
  if (!from || !to || to < from) return [];

  const ticks: AxisTick[] = [];
  const push = (key: string, label: string): void => {
    const x = xForDay(key, fromKey, pxPerDay);
    if (x === null) return;
    const d = parseDay(key) as Date;
    const weekday = getDay(d);
    ticks.push({ key, label, x, isWeekend: weekday === 0 || weekday === 6 });
  };

  if (zoom === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      push(dayKey(d), formatDay(dayKey(d), locale, { day: 'numeric' }));
    }
    return ticks;
  }

  if (zoom === 'week') {
    let cursor = startOfWeek(from, { weekStartsOn: 1 });
    if (cursor < from) cursor = addDays(cursor, 7);
    push(fromKey, formatDay(fromKey, locale, { day: 'numeric', month: 'short' }));
    for (let d = cursor; d <= to; d = addDays(d, 7)) {
      const key = dayKey(d);
      if (key !== fromKey) push(key, formatDay(key, locale, { day: 'numeric', month: 'short' }));
    }
    return ticks;
  }

  push(fromKey, formatDay(fromKey, locale, { month: 'short', year: 'numeric' }));
  let month = startOfMonth(from);
  while (month <= to) {
    const key = dayKey(month);
    if (key > fromKey) push(key, formatDay(key, locale, { month: 'short', year: 'numeric' }));
    month = startOfMonth(addDays(startOfMonth(month), 32));
  }
  return ticks;
}
