/**
 * The edit-task form's data layer: the draft shape, how a task becomes one, how a draft is
 * validated and how it is written back. Pure, so the rules can be unit-tested without a DOM.
 */
import { parseDay } from '../../services/export/common';
import type { Project, Task, TaskChecklistItem, TaskPriority, TaskStatus } from '../../types';

/** Every editable field, with numbers kept as strings so a half-typed value is not destroyed. */
export interface TaskDraft {
  title: string;
  description: string;
  phaseId: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  estimatedHours: string;
  dependencies: string[];
  deliverables: string[];
  checklist: TaskChecklistItem[];
  tags: string[];
}

/** Snapshot of a task as an editable draft. */
export function toDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    phaseId: task.phaseId,
    assigneeId: task.assigneeId,
    status: task.status,
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedHours: String(task.estimatedHours ?? ''),
    dependencies: [...(task.dependencies ?? [])],
    deliverables: [...task.deliverables],
    checklist: task.checklist.map((item) => ({ ...item })),
    tags: [...task.tags],
  };
}

/** The project's first phase by `order` — where a new task lands unless the user says otherwise. */
export function firstPhaseId(project: Project): string {
  const sorted = [...project.phases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted[0]?.id ?? '';
}

/**
 * A blank draft for a new task. Nothing is invented: no dates, no hours, no checklist, no
 * deliverables, nobody assigned. Only the phase is filled in, with the project's first — and it is
 * recomputed every time the form opens, so switching project can never leave a foreign phase id
 * behind (the bug that made new tasks vanish from every lane).
 */
export function emptyDraft(project: Project): TaskDraft {
  return {
    title: '',
    description: '',
    phaseId: firstPhaseId(project),
    assigneeId: '',
    status: 'todo',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    estimatedHours: '',
    dependencies: [],
    deliverables: [],
    checklist: [],
    tags: [],
  };
}

/** A validated draft as the new task to hand to `addTask` (the facade assigns the id). */
export function draftToNewTask(draft: TaskDraft, projectId: string): Omit<Task, 'id'> {
  return {
    projectId,
    phaseId: draft.phaseId,
    title: draft.title.trim(),
    description: draft.description,
    status: draft.status,
    priority: draft.priority,
    assigneeId: draft.assigneeId,
    startDate: draft.startDate,
    dueDate: draft.dueDate,
    estimatedHours: Number(draft.estimatedHours),
    dependencies: [...draft.dependencies],
    deliverables: [...draft.deliverables],
    checklist: draft.checklist.map((item) => ({ ...item })),
    tags: [...draft.tags],
  };
}

/** Field-level messages. `null` means the field is fine. */
export interface DraftValidation {
  title: string | null;
  dates: string | null;
  hours: string | null;
  /** Non-blocking notice (dates outside the project window). */
  warning: string | null;
  /** True when saving must be refused. */
  blocking: boolean;
}

/** Validates a draft against its project: errors block the save, the warning does not. */
export function validateDraft(draft: TaskDraft, project: Project): DraftValidation {
  const title = draft.title.trim() ? null : 'A task needs a title.';

  const start = parseDay(draft.startDate);
  const due = parseDay(draft.dueDate);
  let dates: string | null = null;
  if (!start || !due) dates = 'Both dates must be real calendar days.';
  else if (draft.dueDate < draft.startDate) dates = 'The due date is before the start date.';

  const raw = draft.estimatedHours.trim();
  const hoursValue = Number(raw);
  const hours =
    raw === '' || !Number.isFinite(hoursValue) || hoursValue < 0
      ? 'Estimated hours must be a number of zero or more.'
      : null;

  let warning: string | null = null;
  if (!dates && parseDay(project.startDate) && parseDay(project.targetDeliveryDate)) {
    const before = draft.startDate < project.startDate;
    const after = draft.dueDate > project.targetDeliveryDate;
    if (before || after) {
      warning = `Outside the project window (${project.startDate} → ${project.targetDeliveryDate}). Saved anyway.`;
    }
  }

  return { title, dates, hours, warning, blocking: Boolean(title || dates || hours) };
}

/** Applies a validated draft to the task it came from. */
export function applyDraft(task: Task, draft: TaskDraft): Task {
  return {
    ...task,
    title: draft.title.trim(),
    description: draft.description,
    phaseId: draft.phaseId,
    assigneeId: draft.assigneeId,
    status: draft.status,
    priority: draft.priority,
    startDate: draft.startDate,
    dueDate: draft.dueDate,
    estimatedHours: Number(draft.estimatedHours),
    dependencies: [...draft.dependencies],
    deliverables: [...draft.deliverables],
    checklist: draft.checklist.map((item) => ({ ...item })),
    tags: [...draft.tags],
  };
}

/** Moves a checklist item by `delta` positions; returns the same array when it cannot move. */
export function moveChecklistItem(
  checklist: readonly TaskChecklistItem[],
  index: number,
  delta: number
): TaskChecklistItem[] {
  const target = index + delta;
  if (index < 0 || index >= checklist.length || target < 0 || target >= checklist.length) {
    return [...checklist];
  }
  const next = [...checklist];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
