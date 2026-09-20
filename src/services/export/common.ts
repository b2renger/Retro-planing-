/**
 * Small helpers shared by every export format (dates, people, colours, ordering).
 * Pure functions only — safe to import from tests and from the browser bundle.
 */
import { format, isValid, parseISO } from 'date-fns';
import type { Phase, Project, Task, TaskStatus, User } from '../../types';

/** Identifier of the synthetic group that receives tasks whose `phaseId` matches no phase. */
export const UNSCHEDULED_PHASE_ID = 'unscheduled';
/** Display name of the synthetic "no phase" group. */
export const UNSCHEDULED_PHASE_NAME = 'Unscheduled';
/** Neutral grey used for rows that have no colour of their own. */
export const NEUTRAL_COLOR = '#9CA3AF';

/** Human-readable label for each task status. */
export const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  todo: 'To do',
  'in-progress': 'In progress',
  'in-review': 'In review',
  blocked: 'Blocked',
  done: 'Done',
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}/;

/**
 * Parses a `YYYY-MM-DD` string (a longer ISO timestamp is truncated to its date part) into a
 * local-midnight `Date`. Returns `null` for anything that is not a real calendar day.
 */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!DAY_KEY.test(trimmed)) return null;
  const date = parseISO(trimmed.slice(0, 10));
  if (!isValid(date)) return null;
  // parseISO accepts e.g. 2026-02-30 by rolling over; reject those so the key round-trips.
  return format(date, 'yyyy-MM-dd') === trimmed.slice(0, 10) ? date : null;
}

/** Formats a date as the canonical `YYYY-MM-DD` key used throughout the exports. */
export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Builds a UTC-midnight `Date` for a day key, which is what spreadsheet serial dates expect. */
export function dayKeyToUtcDate(key: string): Date | null {
  if (!parseDay(key)) return null;
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Resolves a member id to a display name; falls back to the raw id (or an empty string). */
export function memberName(members: readonly User[] | undefined, id: string | undefined): string {
  if (!id) return '';
  return members?.find((m) => m.id === id)?.name ?? id;
}

/**
 * Converts a CSS hex colour (`#RGB` or `#RRGGBB`) to the opaque `AARRGGBB` form ExcelJS expects.
 * Invalid input yields `fallback` (neutral grey by default).
 */
export function hexToArgb(hex: string | undefined, fallback = 'FF9CA3AF'): string {
  if (!hex) return fallback;
  const raw = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return ('FF' + raw.split('').map((c) => c + c).join('')).toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return ('FF' + raw).toUpperCase();
  if (/^[0-9a-f]{8}$/i.test(raw)) return raw.toUpperCase();
  return fallback;
}

/** Normalises a colour to `#RRGGBB` (lower-case hex); invalid input yields `NEUTRAL_COLOR`. */
export function normalizeHex(hex: string | undefined): string {
  const argb = hexToArgb(hex, '');
  return argb ? '#' + argb.slice(2).toLowerCase() : NEUTRAL_COLOR;
}

/** Escapes the five XML special characters for use in element text or attribute values. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Completion ratio of a task in `[0, 1]`: the checklist ratio when it has items, otherwise a
 * value derived from the status (`done` = 1, `in-review` = 0.9, `in-progress` = 0.5, else 0).
 */
export function taskProgress(task: Task): number {
  const checklist = task.checklist ?? [];
  if (checklist.length > 0) {
    return checklist.filter((c) => c.completed).length / checklist.length;
  }
  switch (task.status) {
    case 'done':
      return 1;
    case 'in-review':
      return 0.9;
    case 'in-progress':
      return 0.5;
    default:
      return 0;
  }
}

/** Sorts tasks by start date, then due date, then title (stable, non-mutating). */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
      (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
      (a.title ?? '').localeCompare(b.title ?? '')
  );
}

/** Sorts phases by `order`, then start date (stable, non-mutating). */
export function sortPhases(phases: readonly Phase[]): Phase[] {
  return [...phases].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.startDate ?? '').localeCompare(b.startDate ?? '')
  );
}

/** A phase together with its (sorted) tasks; `phase` is `null` for the "Unscheduled" group. */
export interface PhaseGroup {
  phase: Phase | null;
  /** Stable id: the phase id, or `UNSCHEDULED_PHASE_ID`. */
  id: string;
  name: string;
  color: string;
  tasks: Task[];
}

/**
 * Groups the project's tasks under their phase, in phase order, tasks sorted by start date.
 * Tasks whose `phaseId` matches no phase end up in a trailing "Unscheduled" group, which is
 * only present when non-empty. Phases without tasks are still returned.
 */
export function groupTasksByPhase(project: Project): PhaseGroup[] {
  const phases = sortPhases(project.phases ?? []);
  const known = new Set(phases.map((p) => p.id));
  const byPhase = new Map<string, Task[]>();
  const unscheduled: Task[] = [];
  for (const task of project.tasks ?? []) {
    if (known.has(task.phaseId)) {
      const list = byPhase.get(task.phaseId) ?? [];
      list.push(task);
      byPhase.set(task.phaseId, list);
    } else {
      unscheduled.push(task);
    }
  }
  const groups: PhaseGroup[] = phases.map((phase) => ({
    phase,
    id: phase.id,
    name: phase.name,
    color: normalizeHex(phase.color),
    tasks: sortTasks(byPhase.get(phase.id) ?? []),
  }));
  if (unscheduled.length > 0) {
    groups.push({
      phase: null,
      id: UNSCHEDULED_PHASE_ID,
      name: UNSCHEDULED_PHASE_NAME,
      color: NEUTRAL_COLOR,
      tasks: sortTasks(unscheduled),
    });
  }
  return groups;
}

/** Name of the phase a task belongs to, or "Unscheduled" when it has none. */
export function phaseNameOf(project: Project, phaseId: string): string {
  return project.phases?.find((p) => p.id === phaseId)?.name ?? UNSCHEDULED_PHASE_NAME;
}

/** Title of a task by id, or the id itself when unknown. */
export function taskTitleOf(project: Project, taskId: string): string {
  return project.tasks?.find((t) => t.id === taskId)?.title ?? taskId;
}
