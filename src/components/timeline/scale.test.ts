import { describe, expect, it } from 'vitest';
import { getDay, parseISO } from 'date-fns';
import {
  axisTicks,
  barGeometry,
  barLabelPlacement,
  dayAtX,
  daysBetween,
  deltaDaysFromPx,
  estimateTextWidth,
  FALLBACK_LOCALE,
  formatDay,
  formatDayRange,
  moveInterval,
  outsideLabelWidth,
  rangeWidth,
  resizeInterval,
  resolveLocale,
  shiftDay,
  thinTickLabels,
  xForDay,
  ZOOM_PX_PER_DAY,
} from './scale';

const L = 'en-GB';

describe('day maths', () => {
  it('counts calendar days in both directions', () => {
    expect(daysBetween('2026-03-02', '2026-03-05')).toBe(3);
    expect(daysBetween('2026-03-05', '2026-03-02')).toBe(-3);
    expect(daysBetween('2026-03-02', '2026-03-02')).toBe(0);
  });

  it('crosses a month and a leap day', () => {
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    expect(daysBetween('2028-02-27', '2028-03-02')).toBe(4);
  });

  it('rejects anything that is not a day key', () => {
    expect(daysBetween('nope', '2026-03-02')).toBeNull();
    expect(daysBetween('2026-02-30', '2026-03-02')).toBeNull();
    expect(shiftDay('nope', 1)).toBeNull();
    expect(shiftDay('2026-03-02', Number.NaN)).toBeNull();
  });

  it('shifts a day key by whole days', () => {
    expect(shiftDay('2026-03-02', 4)).toBe('2026-03-06');
    expect(shiftDay('2026-03-02', -4)).toBe('2026-02-26');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('pixel scale', () => {
  it('places a day at its day index times the scale', () => {
    expect(xForDay('2026-03-02', '2026-03-02', 34)).toBe(0);
    expect(xForDay('2026-03-05', '2026-03-02', 34)).toBe(102);
    expect(xForDay('2026-03-01', '2026-03-02', 34)).toBe(-34);
    expect(xForDay('bad', '2026-03-02', 34)).toBeNull();
  });

  it('maps an x offset back to the day that contains it', () => {
    expect(dayAtX(0, '2026-03-02', 34)).toBe('2026-03-02');
    expect(dayAtX(33, '2026-03-02', 34)).toBe('2026-03-02');
    expect(dayAtX(34, '2026-03-02', 34)).toBe('2026-03-03');
    expect(dayAtX(-1, '2026-03-02', 34)).toBe('2026-03-01');
    expect(dayAtX(10, '2026-03-02', 0)).toBeNull();
  });

  it('gives a one-day task exactly one day of width at every zoom', () => {
    for (const px of Object.values(ZOOM_PX_PER_DAY)) {
      expect(barGeometry('2026-03-02', '2026-03-02', '2026-03-02', px)).toEqual({ left: 0, width: px });
    }
  });

  it('measures an inclusive bar', () => {
    expect(barGeometry('2026-03-03', '2026-03-05', '2026-03-02', 10)).toEqual({ left: 10, width: 30 });
    expect(barGeometry('2026-03-05', '2026-03-03', '2026-03-02', 10)).toEqual({ left: 30, width: 10 });
    expect(barGeometry('2026-03-05', 'bad', '2026-03-02', 10)).toBeNull();
  });

  it('measures the whole grid inclusively', () => {
    expect(rangeWidth('2026-03-02', '2026-03-02', 34)).toBe(34);
    expect(rangeWidth('2026-03-02', '2026-03-04', 10)).toBe(30);
    expect(rangeWidth('bad', '2026-03-04', 10)).toBe(0);
  });
});

describe('drag to date conversion', () => {
  it('snaps a pointer delta to whole days', () => {
    expect(deltaDaysFromPx(0, 34)).toBe(0);
    expect(deltaDaysFromPx(16, 34)).toBe(0);
    expect(deltaDaysFromPx(17, 34)).toBe(1);
    expect(deltaDaysFromPx(-17, 34)).toBe(-1);
    expect(deltaDaysFromPx(103, 34)).toBe(3);
    expect(deltaDaysFromPx(103, 0)).toBe(0);
    expect(deltaDaysFromPx(Number.NaN, 34)).toBe(0);
  });

  it('moves both ends of an interval', () => {
    expect(moveInterval({ start: '2026-03-02', end: '2026-03-05' }, 3)).toEqual({
      start: '2026-03-05',
      end: '2026-03-08',
    });
    const broken = { start: 'bad', end: '2026-03-05' };
    expect(moveInterval(broken, 3)).toBe(broken);
  });

  it('resizes one edge and never lets the bar collapse below a day', () => {
    const iv = { start: '2026-03-02', end: '2026-03-05' };
    expect(resizeInterval(iv, 2, 'end')).toEqual({ start: '2026-03-02', end: '2026-03-07' });
    expect(resizeInterval(iv, -2, 'start')).toEqual({ start: '2026-02-28', end: '2026-03-05' });
    expect(resizeInterval(iv, 10, 'start')).toEqual({ start: '2026-03-05', end: '2026-03-05' });
    expect(resizeInterval(iv, -10, 'end')).toEqual({ start: '2026-03-02', end: '2026-03-02' });
  });
});

describe('labels', () => {
  it('formats with the given locale and falls back to the raw key', () => {
    expect(formatDay('2026-03-02', L, { day: 'numeric' })).toBe('2');
    expect(formatDay('2026-03-02', L, { month: 'short' })).toBe('Mar');
    expect(formatDay('nope', L, { day: 'numeric' })).toBe('nope');
  });

  it('formats a range and collapses a single day', () => {
    expect(formatDayRange('2026-03-02', '2026-03-05', L)).toBe('2 Mar – 5 Mar');
    expect(formatDayRange('2026-03-02', '2026-03-02', L)).toBe('2 Mar');
  });

  it('resolves a usable locale', () => {
    const locale = resolveLocale();
    expect(typeof locale).toBe('string');
    expect(locale.length).toBeGreaterThan(0);
    expect(FALLBACK_LOCALE).toBe('en-GB');
  });
});

describe('axisTicks', () => {
  it('emits one tick per day at day zoom, flagging weekends', () => {
    const ticks = axisTicks('2026-03-02', '2026-03-08', 'day', 34, L);
    expect(ticks).toHaveLength(7);
    expect(ticks.map((t) => t.x)).toEqual([0, 34, 68, 102, 136, 170, 204]);
    expect(ticks.map((t) => t.label)).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    for (const tick of ticks) {
      const weekday = getDay(parseISO(tick.key));
      expect(tick.isWeekend).toBe(weekday === 0 || weekday === 6);
    }
  });

  it('emits the range start then every Monday at week zoom', () => {
    const ticks = axisTicks('2026-03-04', '2026-03-25', 'week', 13, L);
    expect(ticks[0].key).toBe('2026-03-04');
    expect(ticks[0].x).toBe(0);
    for (const tick of ticks.slice(1)) {
      expect(getDay(parseISO(tick.key))).toBe(1);
    }
    for (let i = 2; i < ticks.length; i++) {
      expect(ticks[i].x - ticks[i - 1].x).toBe(7 * 13);
    }
  });

  it('emits the range start then every month start at month zoom', () => {
    const ticks = axisTicks('2026-03-02', '2026-05-10', 'month', 5, L);
    expect(ticks.map((t) => t.key)).toEqual(['2026-03-02', '2026-04-01', '2026-05-01']);
    expect(ticks.map((t) => t.label)).toEqual(['Mar 2026', 'Apr 2026', 'May 2026']);
  });

  it('returns nothing for an impossible range', () => {
    expect(axisTicks('2026-03-08', '2026-03-02', 'day', 34, L)).toEqual([]);
    expect(axisTicks('bad', '2026-03-02', 'day', 34, L)).toEqual([]);
  });
});

describe('estimateTextWidth', () => {
  it('grows with the length of the text and the font size', () => {
    expect(estimateTextWidth('abcd', 10)).toBeCloseTo(4 * 10 * 0.55);
    expect(estimateTextWidth('abcd', 20)).toBeCloseTo(2 * estimateTextWidth('abcd', 10));
    expect(estimateTextWidth('abcd', 10, 'mono')).toBeGreaterThan(estimateTextWidth('abcd', 10, 'sans'));
  });

  it('is zero for an empty string or an impossible font size', () => {
    expect(estimateTextWidth('', 10)).toBe(0);
    expect(estimateTextWidth('abcd', 0)).toBe(0);
    expect(estimateTextWidth('abcd', Number.NaN)).toBe(0);
  });
});

describe('thinTickLabels', () => {
  it('hides a label that would touch the one before it', () => {
    const out = thinTickLabels([
      { x: 0, label: 'Sep 13', edge: false },
      { x: 4, label: 'Sep 14', edge: false },
      { x: 400, label: 'Sep 21', edge: false },
    ]);
    expect(out.map((t) => t.showLabel)).toEqual([true, false, true]);
  });

  it('lets the cadence win over the tick that only pins the range start', () => {
    const out = thinTickLabels([
      { x: 0, label: 'Sep 13', edge: true },
      { x: 13, label: 'Sep 14', edge: false },
    ]);
    expect(out.map((t) => t.showLabel)).toEqual([false, true]);
  });

  it('keeps the range-start label when no cadence label needs that space', () => {
    const out = thinTickLabels([
      { x: 0, label: 'Sep 13', edge: true },
      { x: 91, label: 'Sep 21', edge: false },
    ]);
    expect(out.map((t) => t.showLabel)).toEqual([true, true]);
  });
});

describe('axis labels never collide', () => {
  it('drops the range-start label when the first Monday lands beside it', () => {
    const ticks = axisTicks('2026-03-15', '2026-04-30', 'week', ZOOM_PX_PER_DAY.week, L);
    expect(ticks[0].key).toBe('2026-03-15');
    expect(ticks[0].edge).toBe(true);
    expect(ticks[0].showLabel).toBe(false);
    expect(ticks[1].key).toBe('2026-03-16');
    expect(ticks[1].showLabel).toBe(true);
  });

  it('keeps every label when the range starts on a Monday', () => {
    const ticks = axisTicks('2026-03-02', '2026-03-25', 'week', ZOOM_PX_PER_DAY.week, L);
    expect(ticks.every((t) => t.showLabel)).toBe(true);
  });

  it('leaves room between two visible labels at every zoom', () => {
    for (const zoom of ['day', 'week', 'month'] as const) {
      const ticks = axisTicks('2026-03-15', '2026-09-30', zoom, ZOOM_PX_PER_DAY[zoom], L);
      const shown = ticks.filter((t) => t.showLabel);
      expect(shown.length).toBeGreaterThan(0);
      for (let i = 1; i < shown.length; i++) {
        const previousRight = shown[i - 1].x + estimateTextWidth(shown[i - 1].label, 10, 'mono');
        expect(shown[i].x).toBeGreaterThanOrEqual(previousRight);
      }
    }
  });
});

describe('barLabelPlacement', () => {
  it('keeps the label inside a bar that can hold a readable run of it', () => {
    expect(barLabelPlacement(240, 'Venue Booking & Electrical Power Survey')).toBe('inside');
    expect(barLabelPlacement(80, 'Venue Booking & Electrical Power Survey')).toBe('inside');
    // A short name in a one-day bar at day zoom still fits.
    expect(barLabelPlacement(ZOOM_PX_PER_DAY.day, 'Ack')).toBe('inside');
  });

  it('moves the label outside a bar with no room for one', () => {
    expect(barLabelPlacement(13, 'Acoustic Alignment, Dante Network Commissioning')).toBe('outside');
    expect(barLabelPlacement(5, 'Final Safety Inspection')).toBe('outside');
  });

  it('counts the flame or lock icon a bar carries', () => {
    expect(barLabelPlacement(60, 'Wide enough', 0)).toBe('inside');
    expect(barLabelPlacement(60, 'Wide enough', 1)).toBe('outside');
  });

  it('puts the label outside when the width is not a number', () => {
    expect(barLabelPlacement(Number.NaN, 'Anything')).toBe('outside');
  });
});

describe('outsideLabelWidth', () => {
  it('uses the room available, never more than the label needs', () => {
    expect(outsideLabelWidth(400, 'Artist Creative Walkthrough')).toBe(
      Math.round(estimateTextWidth('Artist Creative Walkthrough', 11))
    );
    expect(outsideLabelWidth(60, 'Artist Creative Walkthrough')).toBe(54);
  });

  it('draws nothing when the next bar is too close', () => {
    expect(outsideLabelWidth(30, 'Artist Creative Walkthrough')).toBe(0);
    expect(outsideLabelWidth(0, 'Artist Creative Walkthrough')).toBe(0);
    expect(outsideLabelWidth(-40, 'Artist Creative Walkthrough')).toBe(0);
  });

  it('caps a very long label even with the whole chart to spare', () => {
    expect(outsideLabelWidth(4000, 'x'.repeat(400))).toBe(220);
  });

  it('draws nothing when the room is not a number', () => {
    expect(outsideLabelWidth(Number.NaN, 'Anything')).toBe(0);
  });
});
