import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT } from '../../data/mockData';
import { buildGanttModel } from '../../services/export/gantt';
import {
  buildRowLayout,
  GROUP_GAP,
  LANE_ROW_HEIGHT,
  packLanes,
  PHASE_ROW_HEIGHT,
  ROW_GAP,
  rowCenterY,
  stackMilestoneFlags,
} from './layout';

const item = (id: string, start: string, end: string) => ({ id, start, end });

describe('packLanes', () => {
  it('keeps non-overlapping tasks on one lane', () => {
    const lanes = packLanes([
      item('a', '2026-03-02', '2026-03-03'),
      item('b', '2026-03-05', '2026-03-06'),
      item('c', '2026-03-08', '2026-03-09'),
    ]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('opens a new lane for every overlapping task so none is hidden', () => {
    const lanes = packLanes([
      item('a', '2026-03-02', '2026-03-10'),
      item('b', '2026-03-03', '2026-03-11'),
      item('c', '2026-03-04', '2026-03-12'),
    ]);
    expect(lanes.map((lane) => lane.map((t) => t.id))).toEqual([['a'], ['b'], ['c']]);
  });

  it('treats a shared boundary day as an overlap', () => {
    const lanes = packLanes([item('a', '2026-03-02', '2026-03-05'), item('b', '2026-03-05', '2026-03-07')]);
    expect(lanes).toHaveLength(2);
  });

  it('reuses a lane as soon as it is free', () => {
    const lanes = packLanes([
      item('a', '2026-03-02', '2026-03-06'),
      item('b', '2026-03-03', '2026-03-04'),
      item('c', '2026-03-08', '2026-03-09'),
    ]);
    expect(lanes.map((lane) => lane.map((t) => t.id))).toEqual([['a', 'c'], ['b']]);
  });

  it('is order independent and never drops an item', () => {
    const items = [
      item('c', '2026-03-04', '2026-03-12'),
      item('a', '2026-03-02', '2026-03-10'),
      item('d', '2026-03-20', '2026-03-21'),
      item('b', '2026-03-03', '2026-03-11'),
    ];
    const lanes = packLanes(items);
    expect(lanes.flat().map((t) => t.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(lanes.map((lane) => lane.map((t) => t.id))).toEqual([['a', 'd'], ['b'], ['c']]);
  });

  it('handles an empty list', () => {
    expect(packLanes([])).toEqual([]);
  });
});

describe('buildRowLayout', () => {
  it('stacks a phase header above its lanes and reports the total height', () => {
    const { rows, height } = buildRowLayout([
      { id: 'ph1', lanes: [['t1', 't2'], ['t3']] },
      { id: 'ph2', lanes: [['t4']] },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['ph1', 'ph1#0', 'ph1#1', 'ph2', 'ph2#0']);
    expect(rows.map((r) => r.top)).toEqual([
      0,
      PHASE_ROW_HEIGHT + ROW_GAP,
      PHASE_ROW_HEIGHT + 2 * ROW_GAP + LANE_ROW_HEIGHT,
      PHASE_ROW_HEIGHT + 2 * ROW_GAP + 2 * LANE_ROW_HEIGHT + GROUP_GAP,
      PHASE_ROW_HEIGHT + 2 * ROW_GAP + 2 * LANE_ROW_HEIGHT + GROUP_GAP + PHASE_ROW_HEIGHT + ROW_GAP,
    ]);
    expect(height).toBe(rows[4].top + LANE_ROW_HEIGHT);
    expect(rows[1].taskIds).toEqual(['t1', 't2']);
    expect(rows[0].kind).toBe('phase');
    expect(rows[0].laneIndex).toBe(-1);
    expect(rowCenterY(rows[1])).toBe(rows[1].top + LANE_ROW_HEIGHT / 2);
  });

  it('renders a phase with no task as a header row only', () => {
    const { rows, height } = buildRowLayout([{ id: 'ph1', lanes: [] }]);
    expect(rows).toHaveLength(1);
    expect(height).toBe(PHASE_ROW_HEIGHT);
  });

  it('handles a project with no phase at all', () => {
    expect(buildRowLayout([])).toEqual({ rows: [], height: 0 });
  });
});

describe('stackMilestoneFlags', () => {
  it('keeps well-separated flags on the first level', () => {
    const placed = stackMilestoneFlags([{ id: 'a', x: 0 }, { id: 'b', x: 200 }], 120, 3);
    expect(placed.map((p) => p.level)).toEqual([0, 0]);
    expect(placed.every((p) => p.collapsedIds.length === 0)).toBe(true);
  });

  it('staggers flags that would collide', () => {
    const placed = stackMilestoneFlags(
      [{ id: 'a', x: 0 }, { id: 'b', x: 30 }, { id: 'c', x: 60 }],
      120,
      3
    );
    expect(placed.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(placed.map((p) => p.level)).toEqual([0, 1, 2]);
  });

  it('collapses into a "+N" chip once every level is busy', () => {
    const placed = stackMilestoneFlags(
      [{ id: 'a', x: 0 }, { id: 'b', x: 10 }, { id: 'c', x: 20 }, { id: 'd', x: 30 }, { id: 'e', x: 40 }],
      120,
      3
    );
    expect(placed.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(placed[2].collapsedIds).toEqual(['d', 'e']);
  });

  it('sorts by position before placing', () => {
    const placed = stackMilestoneFlags([{ id: 'late', x: 300 }, { id: 'early', x: 0 }], 120, 2);
    expect(placed.map((p) => p.id)).toEqual(['early', 'late']);
  });

  it('frees a level again once the gap is wide enough', () => {
    const placed = stackMilestoneFlags(
      [{ id: 'a', x: 0 }, { id: 'b', x: 30 }, { id: 'c', x: 150 }],
      120,
      2
    );
    expect(placed.map((p) => p.level)).toEqual([0, 1, 0]);
  });

  it('handles an empty list', () => {
    expect(stackMilestoneFlags([], 120, 3)).toEqual([]);
  });
});

describe('lane packing on the sample project', () => {
  it('separates the overlapping media tasks the single-track layout used to hide', () => {
    const model = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: '2026-10-01' });
    const byPhase = new Map<string, { id: string; start: string; end: string }[]>();
    for (const row of model.rows) {
      if (row.kind !== 'task' || !row.phaseId) continue;
      const list = byPhase.get(row.phaseId) ?? [];
      list.push({ id: row.id, start: row.start, end: row.end });
      byPhase.set(row.phaseId, list);
    }

    let maxLanes = 0;
    for (const [, items] of byPhase) {
      const lanes = packLanes(items);
      maxLanes = Math.max(maxLanes, lanes.length);
      // Nothing overlaps inside a lane, and nothing is lost.
      expect(lanes.flat()).toHaveLength(items.length);
      for (const lane of lanes) {
        for (let i = 1; i < lane.length; i++) {
          expect(lane[i - 1].end < lane[i].start).toBe(true);
        }
      }
    }
    expect(maxLanes).toBeGreaterThan(1);
  });
});
