/**
 * Pure Gantt model: turns a project into a grid of date columns × rows (phases, tasks,
 * milestones) that every visual export (xlsx, svg, markdown) renders from.
 */
import {
  addDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  format,
  isWeekend as isWeekendDate,
  startOfWeek,
} from 'date-fns';
import type { Project, Task, User } from '../../types';
import {
  dayKey,
  groupTasksByPhase,
  memberName,
  normalizeHex,
  parseDay,
  taskProgress,
  type PhaseGroup,
} from './common';

/** Width of one Gantt column. */
export type GanttGranularity = 'day' | 'week';

/** The kind of item a Gantt row represents. */
export type GanttRowKind = 'phase' | 'task' | 'milestone';

/** One column of the Gantt grid (a day, or a Monday-based week). */
export interface GanttColumn {
  /** `YYYY-MM-DD` of the day (or of the week's Monday). */
  date: string;
  /** Short header label: day of month for days, `W38` for weeks. */
  label: string;
  /** Saturday/Sunday (always `false` for week columns). */
  isWeekend: boolean;
  /** The column that contains today. */
  isToday: boolean;
  /** The column that contains the project's target delivery date. */
  isTarget: boolean;
}

/** One row of the Gantt grid. */
export interface GanttRow {
  kind: GanttRowKind;
  id: string;
  label: string;
  /** `#rrggbb` colour of the bar. */
  color: string;
  /** `YYYY-MM-DD` first day of the bar (equal to `end` for milestones). */
  start: string;
  /** `YYYY-MM-DD` last day of the bar, inclusive. */
  end: string;
  /** Assignee display name (or id when no member list was supplied); tasks only. */
  assignee?: string;
  /** Task status, or `done`/`pending` for milestones. */
  status?: string;
  /** One entry per column: `1` when the row spans that column. */
  cells: (0 | 1)[];
  /** Completion ratio in `[0, 1]` (checklist or status for tasks, average for phases). */
  progress?: number;
  /** Owning phase id for task rows (`UNSCHEDULED_PHASE_ID` when the task has no valid phase). */
  phaseId?: string;
  /** Flag copied from the project data (tasks and phases). */
  isCriticalPath?: boolean;
}

/** Options for `buildGanttModel`. */
export interface GanttOptions {
  /** Column width; default `day`. */
  granularity?: GanttGranularity;
  /** Override the first column (`YYYY-MM-DD`); ignored when invalid. */
  from?: string;
  /** Override the last column (`YYYY-MM-DD`); ignored when invalid. */
  to?: string;
  /** The day to flag as "today" (`YYYY-MM-DD`); defaults to the current date. */
  today?: string;
  /** Members used to resolve assignee names. */
  members?: readonly User[];
}

/** Result of `buildGanttModel`. */
export interface GanttModel {
  granularity: GanttGranularity;
  /** First day covered by the grid (`YYYY-MM-DD`). */
  from: string;
  /** Last day covered by the grid (`YYYY-MM-DD`). */
  to: string;
  /** The day flagged as today (`YYYY-MM-DD`). */
  today: string;
  /** The project's target delivery date, or `null` when invalid. */
  target: string | null;
  columns: GanttColumn[];
  rows: GanttRow[];
  /** Items that were skipped or adjusted because of invalid data. */
  warnings: string[];
}

/** Number of padding days added on each side of the data range. */
export const GANTT_RANGE_PADDING_DAYS = 2;

const WEEK_OPTS = { weekStartsOn: 1 } as const;

interface ColumnSpan {
  from: string;
  to: string;
}

function minKey(keys: string[]): string | null {
  return keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : null;
}

function maxKey(keys: string[]): string | null {
  return keys.length ? keys.reduce((a, b) => (a > b ? a : b)) : null;
}

function validKeys(values: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const d = parseDay(v);
    if (d) out.push(dayKey(d));
  }
  return out;
}

/** Computes the padded day range covered by the project (or the overrides). */
function computeRange(project: Project, opts: GanttOptions, today: string): { from: Date; to: Date } {
  const starts = validKeys([
    project.startDate,
    ...(project.phases ?? []).map((p) => p.startDate),
    ...(project.tasks ?? []).map((t) => t.startDate),
    ...(project.milestones ?? []).map((m) => m.targetDate),
  ]);
  const ends = validKeys([
    project.targetDeliveryDate,
    ...(project.phases ?? []).map((p) => p.endDate),
    ...(project.tasks ?? []).map((t) => t.dueDate),
    ...(project.milestones ?? []).map((m) => m.targetDate),
  ]);
  const dataMin = minKey([...starts, ...ends]) ?? today;
  const dataMax = maxKey([...starts, ...ends]) ?? today;

  const fromOverride = parseDay(opts.from);
  const toOverride = parseDay(opts.to);
  let from = fromOverride ?? addDays(parseDay(dataMin) as Date, -GANTT_RANGE_PADDING_DAYS);
  let to = toOverride ?? addDays(parseDay(dataMax) as Date, GANTT_RANGE_PADDING_DAYS);
  if (to < from) [from, to] = [to, from];
  if (opts.granularity === 'week') {
    from = startOfWeek(from, WEEK_OPTS);
    to = endOfWeek(to, WEEK_OPTS);
  }
  return { from, to };
}

function buildColumns(
  from: Date,
  to: Date,
  granularity: GanttGranularity,
  today: string,
  target: string | null
): { columns: GanttColumn[]; spans: ColumnSpan[] } {
  const columns: GanttColumn[] = [];
  const spans: ColumnSpan[] = [];
  if (granularity === 'week') {
    for (const weekStart of eachWeekOfInterval({ start: from, end: to }, WEEK_OPTS)) {
      const span = { from: dayKey(weekStart), to: dayKey(endOfWeek(weekStart, WEEK_OPTS)) };
      spans.push(span);
      columns.push({
        date: span.from,
        label: format(weekStart, "'W'II"),
        isWeekend: false,
        isToday: span.from <= today && today <= span.to,
        isTarget: target !== null && span.from <= target && target <= span.to,
      });
    }
  } else {
    for (const day of eachDayOfInterval({ start: from, end: to })) {
      const key = dayKey(day);
      spans.push({ from: key, to: key });
      columns.push({
        date: key,
        label: format(day, 'd'),
        isWeekend: isWeekendDate(day),
        isToday: key === today,
        isTarget: key === target,
      });
    }
  }
  return { columns, spans };
}

function cellsFor(spans: ColumnSpan[], start: string, end: string): (0 | 1)[] {
  return spans.map((s) => (s.from <= end && s.to >= start ? 1 : 0));
}

/** Resolves a task's `[start, end]` day keys; swaps them (with a warning) when reversed. */
function taskInterval(task: Task, warnings: string[]): { start: string; end: string } | null {
  const s = parseDay(task.startDate);
  const e = parseDay(task.dueDate);
  if (!s || !e) {
    warnings.push(
      `Task "${task.title}" (${task.id}) skipped: invalid dates ${String(task.startDate)} → ${String(task.dueDate)}`
    );
    return null;
  }
  let start = dayKey(s);
  let end = dayKey(e);
  if (end < start) {
    warnings.push(`Task "${task.title}" (${task.id}): due date ${end} precedes start ${start}; dates swapped`);
    [start, end] = [end, start];
  }
  return { start, end };
}

function taskRow(task: Task, group: PhaseGroup, spans: ColumnSpan[], opts: GanttOptions, warnings: string[]): GanttRow | null {
  const interval = taskInterval(task, warnings);
  if (!interval) return null;
  const row: GanttRow = {
    kind: 'task',
    id: task.id,
    label: task.title,
    color: group.color,
    start: interval.start,
    end: interval.end,
    assignee: memberName(opts.members, task.assigneeId),
    status: task.status,
    cells: cellsFor(spans, interval.start, interval.end),
    progress: taskProgress(task),
    phaseId: group.id,
  };
  if (task.isCriticalPath !== undefined) row.isCriticalPath = task.isCriticalPath;
  return row;
}

/**
 * Builds the Gantt grid for a project.
 *
 * Range: from the earliest start (project, phases, tasks, milestones) to the latest end —
 * including the target delivery date — padded by `GANTT_RANGE_PADDING_DAYS`; `from`/`to`
 * override the bounds without padding. Week granularity snaps the range to Monday–Sunday.
 *
 * Rows: each phase (sorted by `order`) followed by its tasks sorted by start date, then a
 * synthetic "Unscheduled" group for tasks without a valid phase, then milestones by date.
 * Items with invalid dates are skipped and reported in `warnings`.
 */
export function buildGanttModel(project: Project, opts: GanttOptions = {}): GanttModel {
  const granularity: GanttGranularity = opts.granularity ?? 'day';
  const warnings: string[] = [];
  const today = dayKey(parseDay(opts.today) ?? new Date());
  const targetDate = parseDay(project.targetDeliveryDate);
  const target = targetDate ? dayKey(targetDate) : null;
  if (!targetDate) {
    warnings.push(`Project target delivery date is invalid: ${String(project.targetDeliveryDate)}`);
  }

  const { from, to } = computeRange(project, opts, today);
  const { columns, spans } = buildColumns(from, to, granularity, today, target);
  const rows: GanttRow[] = [];

  for (const group of groupTasksByPhase(project)) {
    const taskRows: GanttRow[] = [];
    for (const task of group.tasks) {
      const row = taskRow(task, group, spans, opts, warnings);
      if (row) taskRows.push(row);
    }

    let phaseRow: GanttRow | null = null;
    if (group.phase) {
      const s = parseDay(group.phase.startDate);
      const e = parseDay(group.phase.endDate);
      if (!s || !e) {
        warnings.push(
          `Phase "${group.phase.name}" (${group.phase.id}) skipped: invalid dates ${String(group.phase.startDate)} → ${String(group.phase.endDate)}`
        );
      } else {
        let start = dayKey(s);
        let end = dayKey(e);
        if (end < start) {
          warnings.push(`Phase "${group.phase.name}" (${group.phase.id}): end ${end} precedes start ${start}; dates swapped`);
          [start, end] = [end, start];
        }
        phaseRow = {
          kind: 'phase',
          id: group.phase.id,
          label: group.phase.name,
          color: group.color,
          start,
          end,
          cells: cellsFor(spans, start, end),
          isCriticalPath: group.phase.isCriticalPath,
        };
      }
    } else if (taskRows.length > 0) {
      const start = minKey(taskRows.map((r) => r.start)) as string;
      const end = maxKey(taskRows.map((r) => r.end)) as string;
      phaseRow = {
        kind: 'phase',
        id: group.id,
        label: group.name,
        color: group.color,
        start,
        end,
        cells: cellsFor(spans, start, end),
      };
    }

    if (phaseRow) {
      if (taskRows.length > 0) {
        phaseRow.progress = taskRows.reduce((sum, r) => sum + (r.progress ?? 0), 0) / taskRows.length;
      }
      rows.push(phaseRow);
    }
    rows.push(...taskRows);
  }

  const milestones = [...(project.milestones ?? [])].sort(
    (a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? '') || (a.title ?? '').localeCompare(b.title ?? '')
  );
  for (const m of milestones) {
    const d = parseDay(m.targetDate);
    if (!d) {
      warnings.push(`Milestone "${m.title}" (${m.id}) skipped: invalid date ${String(m.targetDate)}`);
      continue;
    }
    const key = dayKey(d);
    rows.push({
      kind: 'milestone',
      id: m.id,
      label: m.title,
      color: m.isHardDeadline ? '#dc2626' : normalizeHex(undefined),
      start: key,
      end: key,
      status: m.completed ? 'done' : 'pending',
      cells: cellsFor(spans, key, key),
      progress: m.completed ? 1 : 0,
    });
  }

  return {
    granularity,
    from: dayKey(from),
    to: dayKey(to),
    today,
    target,
    columns,
    rows,
    warnings,
  };
}

/**
 * Longest chain of dependent tasks, weighted by `estimatedHours`, returned as task ids from
 * the first task to the last. Unknown dependency ids are ignored and dependency cycles are
 * broken at the back edge, so the function always terminates. Returns `[]` when the project
 * has no tasks with positive estimates.
 */
export function computeCriticalPath(project: Project): string[] {
  const tasks = project.tasks ?? [];
  const byId = new Map<string, Task>();
  for (const t of tasks) byId.set(t.id, t);

  const hoursOf = (t: Task): number =>
    typeof t.estimatedHours === 'number' && Number.isFinite(t.estimatedHours) && t.estimatedHours > 0
      ? t.estimatedHours
      : 0;

  const memo = new Map<string, { total: number; prev: string | null }>();
  const onStack = new Set<string>();

  const longestEndingAt = (id: string): number => {
    const cached = memo.get(id);
    if (cached) return cached.total;
    const task = byId.get(id) as Task;
    onStack.add(id);
    let best = -1;
    let prev: string | null = null;
    for (const dep of task.dependencies ?? []) {
      if (dep === id || !byId.has(dep) || onStack.has(dep)) continue; // unknown id or cycle
      const v = longestEndingAt(dep);
      if (v > best) {
        best = v;
        prev = dep;
      }
    }
    onStack.delete(id);
    const total = (best < 0 ? 0 : best) + hoursOf(task);
    memo.set(id, { total, prev });
    return total;
  };

  let endId: string | null = null;
  let endTotal = 0;
  for (const t of tasks) {
    const total = longestEndingAt(t.id);
    if (total > endTotal) {
      endTotal = total;
      endId = t.id;
    }
  }
  if (!endId) return [];

  const path: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = endId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    path.push(cursor);
    cursor = memo.get(cursor)?.prev ?? null;
  }
  return path.reverse();
}
