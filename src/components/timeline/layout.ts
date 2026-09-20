/**
 * Row layout for the Gantt body: lane packing (so overlapping tasks never hide each other),
 * milestone flag stacking, and the absolute `top`/`height` of every row.
 *
 * Pure module — the chart and the frozen label column both read the same layout, which is the
 * only reason the dependency arrows can be drawn in the same coordinate space as the bars.
 */

/** Height of a phase header row, in pixels. */
export const PHASE_ROW_HEIGHT = 34;
/** Height of one task lane row, in pixels. */
export const LANE_ROW_HEIGHT = 30;
/** Vertical gap between two rows of the same phase. */
export const ROW_GAP = 4;
/** Extra gap between two phase groups. */
export const GROUP_GAP = 12;

/** Anything with an inclusive `[start, end]` day range can be packed into lanes. */
export interface LaneItem {
  id: string;
  start: string;
  end: string;
}

/**
 * Greedy first-fit packing by start date: each item goes into the first lane whose last item
 * ends strictly before it starts, otherwise a new lane is opened. Items sharing a single day
 * therefore land in different lanes, which is what makes them all visible.
 */
export function packLanes<T extends LaneItem>(items: readonly T[]): T[][] {
  const sorted = [...items].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id)
  );
  const lanes: T[][] = [];
  const lastEnd: string[] = [];
  for (const item of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (lastEnd[i] < item.start) {
        lanes[i].push(item);
        lastEnd[i] = item.end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
      lastEnd.push(item.end);
    }
  }
  return lanes;
}

/** A phase and the lanes its tasks were packed into (ids only — the caller owns the objects). */
export interface LaneGroup {
  /** Phase id (or the synthetic unscheduled group id). */
  id: string;
  /** Task ids per lane, in lane order. */
  lanes: string[][];
}

/** One rendered row of the chart body. */
export interface TimelineRow {
  kind: 'phase' | 'lane';
  /** Phase id for a phase row, `<phaseId>#<laneIndex>` for a lane row. */
  id: string;
  phaseId: string;
  /** `-1` on the phase header row. */
  laneIndex: number;
  top: number;
  height: number;
  /** Task ids drawn on this row (empty on a phase row). */
  taskIds: string[];
}

/** Vertical centre of a row, used as the anchor of a dependency arrow. */
export function rowCenterY(row: TimelineRow): number {
  return row.top + row.height / 2;
}

/**
 * Stacks the rows: one header row per phase followed by one row per lane, with a wider gap
 * between groups. Returns the rows and the total body height.
 */
export function buildRowLayout(groups: readonly LaneGroup[]): { rows: TimelineRow[]; height: number } {
  const rows: TimelineRow[] = [];
  let top = 0;
  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) top += GROUP_GAP;
    rows.push({
      kind: 'phase',
      id: group.id,
      phaseId: group.id,
      laneIndex: -1,
      top,
      height: PHASE_ROW_HEIGHT,
      taskIds: [],
    });
    top += PHASE_ROW_HEIGHT;
    group.lanes.forEach((lane, laneIndex) => {
      top += ROW_GAP;
      rows.push({
        kind: 'lane',
        id: `${group.id}#${laneIndex}`,
        phaseId: group.id,
        laneIndex,
        top,
        height: LANE_ROW_HEIGHT,
        taskIds: [...lane],
      });
      top += LANE_ROW_HEIGHT;
    });
  });
  return { rows, height: top };
}

/** A milestone flag placed on a stacking level, possibly swallowing its neighbours. */
export interface FlagPlacement {
  id: string;
  x: number;
  /** Row of the flag strip the chip is drawn on (`0` is the closest to the axis). */
  level: number;
  /** Ids of flags that had no free level and are represented by this chip's "+N" affordance. */
  collapsedIds: string[];
}

/**
 * Places milestone chips so they never overlap: each flag takes the first level that is at
 * least `minGap` pixels clear; when every level is busy the flag is collapsed into the
 * previous chip, which then shows a "+N" affordance instead of silently hiding it.
 */
export function stackMilestoneFlags(
  items: readonly { id: string; x: number }[],
  minGap: number,
  maxLevels: number
): FlagPlacement[] {
  const sorted = [...items].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const levels = Math.max(1, Math.trunc(maxLevels));
  const lastX: number[] = new Array(levels).fill(Number.NEGATIVE_INFINITY);
  const placed: FlagPlacement[] = [];
  for (const item of sorted) {
    let level = -1;
    for (let i = 0; i < levels; i++) {
      if (item.x - lastX[i] >= minGap) {
        level = i;
        break;
      }
    }
    if (level === -1 && placed.length > 0) {
      placed[placed.length - 1].collapsedIds.push(item.id);
      continue;
    }
    if (level === -1) level = 0;
    lastX[level] = item.x;
    placed.push({ id: item.id, x: item.x, level, collapsedIds: [] });
  }
  return placed;
}
