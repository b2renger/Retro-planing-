/**
 * Assembles everything the Gantt needs for one render: the shared `buildGanttModel` grid, the
 * pixels-per-day scale, lane packing, row positions, dependency links and milestone flag
 * placement. All of the maths lives in the pure modules next door; this hook only memoises.
 */
import { useMemo } from 'react';
import { buildGanttModel, computeCriticalPath, type GanttModel, type GanttRow } from '../../services/export/gantt';
import type { Milestone, Project, Task, User } from '../../types';
import { dependencyLinks, type DependencyLink } from './dependencies';
import { buildRowLayout, packLanes, stackMilestoneFlags, type FlagPlacement, type TimelineRow } from './layout';
import {
  axisTicks,
  rangeWidth,
  resolveLocale,
  xForDay,
  ZOOM_PX_PER_DAY,
  type AxisTick,
  type TimelineZoom,
} from './scale';

/** Minimum horizontal room between two milestone chips on the same level, in pixels. */
const FLAG_MIN_GAP = 160;
/** How many rows of milestone chips are stacked before the rest collapse into a "+N". */
const FLAG_LEVELS = 3;

/** Active toolbar filters. `'all'` means no filtering. */
export interface TimelineFilters {
  phaseId: string;
  assigneeId: string;
}

/** A phase (or the synthetic unscheduled group) with the task rows that survived the filters. */
export interface TimelineGroup {
  id: string;
  label: string;
  color: string;
  phaseRow: GanttRow | null;
  taskRows: GanttRow[];
}

/** A placed milestone chip together with its milestone. */
export interface TimelineFlag extends FlagPlacement {
  milestone: Milestone;
  collapsed: Milestone[];
}

/** Everything one render of the chart needs. */
export interface TimelineView {
  model: GanttModel;
  locale: string;
  zoom: TimelineZoom;
  pxPerDay: number;
  /** Total width of the grid in pixels. */
  width: number;
  ticks: AxisTick[];
  groups: TimelineGroup[];
  rows: TimelineRow[];
  bodyHeight: number;
  /** Layout row a task bar is drawn on. */
  rowOfTask: Map<string, TimelineRow>;
  taskRowById: Map<string, GanttRow>;
  taskById: Map<string, Task>;
  /** Task ids on the computed critical path (from `computeCriticalPath`). */
  criticalIds: Set<string>;
  /** Dependency edges whose two ends are both visible right now. */
  links: DependencyLink[];
  flags: TimelineFlag[];
  todayX: number | null;
  targetX: number | null;
  warnings: string[];
  /** True when the project has nothing to draw. */
  isEmpty: boolean;
}

export function useTimelineScale(
  project: Project,
  members: readonly User[],
  zoom: TimelineZoom,
  filters: TimelineFilters
): TimelineView {
  const locale = useMemo(() => resolveLocale(), []);
  const model = useMemo(() => buildGanttModel(project, { members }), [project, members]);
  const criticalIds = useMemo(() => new Set(computeCriticalPath(project)), [project]);
  const taskById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks]);
  const milestoneById = useMemo(() => new Map(project.milestones.map((m) => [m.id, m])), [project.milestones]);
  const pxPerDay = ZOOM_PX_PER_DAY[zoom];

  return useMemo(() => {
    const groups: TimelineGroup[] = [];
    const milestoneRows: GanttRow[] = [];
    const taskRowById = new Map<string, GanttRow>();

    for (const row of model.rows) {
      if (row.kind === 'milestone') {
        milestoneRows.push(row);
        continue;
      }
      if (row.kind === 'phase') {
        groups.push({ id: row.id, label: row.label, color: row.color, phaseRow: row, taskRows: [] });
        continue;
      }
      const group = groups.find((g) => g.id === row.phaseId);
      if (group) group.taskRows.push(row);
    }

    const visibleGroups = groups
      .filter((g) => filters.phaseId === 'all' || g.id === filters.phaseId)
      .map((g) => ({
        ...g,
        taskRows: g.taskRows.filter(
          (row) => filters.assigneeId === 'all' || taskById.get(row.id)?.assigneeId === filters.assigneeId
        ),
      }));

    const laneGroups = visibleGroups.map((group) => ({
      id: group.id,
      lanes: packLanes(group.taskRows.map((row) => ({ id: row.id, start: row.start, end: row.end }))).map((lane) =>
        lane.map((item) => item.id)
      ),
    }));
    const { rows, height } = buildRowLayout(laneGroups);

    const rowOfTask = new Map<string, TimelineRow>();
    for (const row of rows) {
      for (const taskId of row.taskIds) rowOfTask.set(taskId, row);
    }
    for (const group of visibleGroups) {
      for (const row of group.taskRows) taskRowById.set(row.id, row);
    }

    const links = dependencyLinks(project.tasks).filter(
      (link) => rowOfTask.has(link.predecessorId) && rowOfTask.has(link.successorId)
    );

    const flagInputs = milestoneRows
      .map((row) => ({ id: row.id, x: (xForDay(row.start, model.from, pxPerDay) ?? 0) + pxPerDay / 2 }))
      .filter((f) => milestoneById.has(f.id));
    const flags: TimelineFlag[] = stackMilestoneFlags(flagInputs, FLAG_MIN_GAP, FLAG_LEVELS).map((placement) => ({
      ...placement,
      milestone: milestoneById.get(placement.id) as Milestone,
      collapsed: placement.collapsedIds
        .map((id) => milestoneById.get(id))
        .filter((m): m is Milestone => Boolean(m)),
    }));

    return {
      model,
      locale,
      zoom,
      pxPerDay,
      width: rangeWidth(model.from, model.to, pxPerDay),
      ticks: axisTicks(model.from, model.to, zoom, pxPerDay, locale),
      groups: visibleGroups,
      rows,
      bodyHeight: height,
      rowOfTask,
      taskRowById,
      taskById,
      criticalIds,
      links,
      flags,
      todayX: xForDay(model.today, model.from, pxPerDay),
      targetX: model.target ? xForDay(model.target, model.from, pxPerDay) : null,
      warnings: model.warnings,
      isEmpty: project.phases.length === 0 && project.tasks.length === 0,
    };
  }, [model, locale, pxPerDay, zoom, filters.phaseId, filters.assigneeId, taskById, milestoneById, criticalIds, project.tasks, project.phases.length]);
}
