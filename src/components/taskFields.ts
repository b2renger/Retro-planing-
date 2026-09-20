/**
 * The one list of task statuses and priorities the UI renders. Every `<select>`, Kanban column
 * and inspector reads from here so a status can never exist in the data but be missing from a
 * control (which is how `in-review` used to display as "To Do").
 */
import { STATUS_LABELS } from '../services/export/common';
import type { TaskPriority, TaskStatus } from '../types';

/** Workflow order, left to right. */
export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in-progress', 'in-review', 'blocked', 'done'];

/** Display label of each status (shared with the exports). */
export const TASK_STATUS_LABELS = STATUS_LABELS;

/** Border accent of each status column / chip. */
export const TASK_STATUS_ACCENTS: Readonly<Record<TaskStatus, string>> = {
  todo: 'border-line-strong',
  'in-progress': 'border-blue-500/40',
  'in-review': 'border-purple-500/40',
  blocked: 'border-rose-500/40',
  done: 'border-emerald-500/40',
};

/** Priorities, most urgent first. */
export const TASK_PRIORITIES: readonly TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

/** Display label of each priority. */
export const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Colours assigned to a newly created phase, cycled by phase order. These are data values
 * stored on the phase (the Gantt paints bars from them), not UI styling.
 */
export const PHASE_PALETTE: readonly string[] = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];
