/**
 * Pure reducer over the projects array. Every mutation of a project — the data change AND its
 * history entry — happens in one case against the current state, so two calls in the same tick can
 * never overwrite each other (audit §5, "stale closures").
 *
 * Every action carries `projectId`, an `actor` (for history) and `at` (ISO timestamp, injected so
 * the reducer is deterministic in tests). Action creators fill `at` with `new Date()`.
 */
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type {
  ClarificationQuestion,
  Comment,
  HistoryEntry,
  MarkdownDoc,
  Milestone,
  Phase,
  Project,
  ProjectCloudLink,
  Task,
  TaskChecklistItem,
  TaskPriority,
  TaskStatus,
} from '../types';
import { newId } from './ids';

export const HISTORY_CAP = 300;

export interface Actor {
  id: string;
  name: string;
  avatar: string;
}

interface Base {
  projectId: string;
  actor: Actor;
  /** ISO 8601 timestamp of the action. */
  at: string;
}

export type TargetDateMode = 'anchor-only' | 'shift-all';

export type HistoryInput = Omit<HistoryEntry, 'id' | 'timestamp' | 'userId' | 'userName' | 'userAvatar'>;

/** Loose shape accepted by `applyAiStructure` (the AI layer's CrunchResult, or anything alike). */
export interface AiStructuredInput {
  phases?: unknown;
  milestones?: unknown;
  tasks?: unknown;
  clarificationQuestions?: unknown;
  summary?: unknown;
}

export type ProjectsAction =
  | ({ type: 'project/create'; project: Project } & Base)
  | ({ type: 'project/update'; patch: Partial<Project> } & Base)
  | ({ type: 'project/delete' } & Base)
  | ({ type: 'project/restore'; project: Project } & Base)
  | ({ type: 'task/add'; task: Task } & Base)
  | ({ type: 'task/update'; task: Task } & Base)
  | ({ type: 'task/delete'; taskId: string } & Base)
  | ({ type: 'task/setStatus'; taskId: string; status: TaskStatus } & Base)
  | ({ type: 'task/toggleChecklistItem'; taskId: string; itemId: string } & Base)
  | ({ type: 'phase/add'; phase: Phase } & Base)
  | ({ type: 'phase/update'; phaseId: string; patch: Partial<Phase> } & Base)
  | ({ type: 'phase/delete'; phaseId: string } & Base)
  | ({ type: 'milestone/add'; milestone: Milestone } & Base)
  | ({ type: 'milestone/update'; milestoneId: string; patch: Partial<Milestone> } & Base)
  | ({ type: 'milestone/delete'; milestoneId: string } & Base)
  | ({ type: 'milestone/toggle'; milestoneId: string } & Base)
  | ({ type: 'project/setTargetDeliveryDate'; date: string; mode: TargetDateMode } & Base)
  | ({ type: 'document/save'; doc: MarkdownDoc } & Base)
  | ({ type: 'document/create'; doc: MarkdownDoc } & Base)
  | ({ type: 'document/delete'; docId: string } & Base)
  | ({ type: 'document/import'; docs: MarkdownDoc[] } & Base)
  | ({ type: 'project/applyAiStructure'; structured: AiStructuredInput; replace: boolean; knownAssigneeIds: string[] } & Base)
  | ({ type: 'comment/add'; comment: Comment } & Base)
  | ({ type: 'history/add'; entry: HistoryInput } & Base)
  | ({ type: 'clarification/resolve'; questionId: string; response: string } & Base)
  | ({ type: 'cloud/setLink'; link: ProjectCloudLink | null } & Base)
  | ({ type: 'cloud/applyPatch'; documents?: MarkdownDoc[]; projectPatch?: Partial<Project> } & Base);

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real `YYYY-MM-DD` calendar day. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const d = parseISO(value);
  return isValid(d) && format(d, 'yyyy-MM-dd') === value;
}

function toDay(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const key = value.slice(0, 10);
  if (!DAY_RE.test(key)) return null;
  const d = parseISO(key);
  return isValid(d) ? d : null;
}

/** Shift a `YYYY-MM-DD` string by `delta` days; invalid dates are returned untouched. */
export function shiftDay(value: string, delta: number): string {
  const d = toDay(value);
  return d ? format(addDays(d, delta), 'yyyy-MM-dd') : value;
}

/** Calendar-day difference `to - from`; null when either side is not a date. */
export function dayDiff(from: string, to: string): number | null {
  const a = toDay(from);
  const b = toDay(to);
  return a && b ? differenceInCalendarDays(b, a) : null;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface ProjectHealth {
  daysRemaining: number;
  overdueTasks: number;
  tasksDone: number;
  tasksTotal: number;
  /** True when the latest phase/task/milestone date lies after the target delivery date. */
  scheduleEndsAfterTarget: boolean;
  /** Days between the end of the schedule and the target (negative when the schedule overruns). */
  slackDays: number;
  /** `clamp(0, 100, 100 - 10 * overdueTasks - (scheduleEndsAfterTarget ? 30 : 0))`. */
  retroplanningScore: number;
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Real numbers derived from the project's dates. `today` defaults to now (pass a fixed date in tests). */
export function computeProjectHealth(project: Project, today: Date | string = new Date()): ProjectHealth {
  const now = typeof today === 'string' ? toDay(today) ?? new Date() : today;
  const target = toDay(project.targetDeliveryDate);
  const todayKey = format(now, 'yyyy-MM-dd');

  const tasksTotal = project.tasks.length;
  const tasksDone = project.tasks.filter((t) => t.status === 'done').length;
  const overdueTasks = project.tasks.filter((t) => t.status !== 'done' && toDay(t.dueDate) && t.dueDate.slice(0, 10) < todayKey).length;

  const ends: Date[] = [];
  for (const p of project.phases) {
    const d = toDay(p.endDate);
    if (d) ends.push(d);
  }
  for (const t of project.tasks) {
    const d = toDay(t.dueDate);
    if (d) ends.push(d);
  }
  for (const m of project.milestones) {
    const d = toDay(m.targetDate);
    if (d) ends.push(d);
  }
  const scheduleEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

  const daysRemaining = target ? differenceInCalendarDays(target, now) : 0;
  const slackDays = target && scheduleEnd ? differenceInCalendarDays(target, scheduleEnd) : daysRemaining;
  const scheduleEndsAfterTarget = Boolean(target && scheduleEnd && scheduleEnd.getTime() > target.getTime());

  return {
    daysRemaining,
    overdueTasks,
    tasksDone,
    tasksTotal,
    scheduleEndsAfterTarget,
    slackDays,
    retroplanningScore: clamp(0, 100, 100 - 10 * overdueTasks - (scheduleEndsAfterTarget ? 30 : 0)),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function history(base: Base, entry: HistoryInput): HistoryEntry {
  return {
    id: newId('hist'),
    timestamp: base.at,
    userId: base.actor.id,
    userName: base.actor.name,
    userAvatar: base.actor.avatar,
    ...entry,
  };
}

/** Recompute the derived score so the persisted field never drifts from the dates. */
function finalize(project: Project, at: string): Project {
  return { ...project, retroplanningScore: computeProjectHealth(project, at).retroplanningScore };
}

function withHistory(project: Project, base: Base, entry: HistoryInput | null): Project {
  if (!entry) return project;
  return { ...project, history: [history(base, entry), ...project.history].slice(0, HISTORY_CAP) };
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function objArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

const STATUSES: readonly TaskStatus[] = ['todo', 'in-progress', 'in-review', 'blocked', 'done'];
const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

/** Bring a partial project (e.g. from a create form) up to a full, self-consistent `Project`. */
export function normalizeProject(input: Partial<Project>, defaults: { workspaceId: string; at: string }): Project {
  const id = str(input.id).trim() || newId('proj');
  const startDate = isDay(input.startDate) ? input.startDate : defaults.at.slice(0, 10);
  const targetDeliveryDate = isDay(input.targetDeliveryDate) ? input.targetDeliveryDate : shiftDay(startDate, 60);
  const project: Project = {
    id,
    workspaceId: str(input.workspaceId) || defaults.workspaceId,
    title: str(input.title).trim() || 'Untitled Project',
    clientName: str(input.clientName) || 'Internal',
    description: str(input.description),
    status: oneOf(input.status, ['on-track', 'at-risk', 'in-review', 'completed'] as const, 'on-track'),
    targetDeliveryDate,
    startDate,
    phases: (input.phases ?? []).map((p, i) => ({ ...p, order: num(p.order, i + 1) })),
    tasks: (input.tasks ?? []).map((t) => ({ ...t, projectId: id })),
    milestones: (input.milestones ?? []).map((m) => ({ ...m, completed: bool(m.completed) })),
    documents: input.documents ?? [],
    history: input.history ?? [],
    comments: input.comments ?? [],
    clarificationQuestions: input.clarificationQuestions ?? [],
    retroplanningScore: 0,
    tags: input.tags ?? [],
  };
  if (input.hardwareItems) project.hardwareItems = input.hardwareItems;
  if (input.mediaAssets) project.mediaAssets = input.mediaAssets;
  if (input.cloud) project.cloud = input.cloud;
  if (input.isTutorialTemplate) project.isTutorialTemplate = true;
  return finalize(project, defaults.at);
}

interface NormalizedStructure {
  phases: Phase[];
  milestones: Milestone[];
  tasks: Task[];
  clarificationQuestions: ClarificationQuestion[];
}

/**
 * Turn untrusted AI output into valid entities with FRESH ids. References (task.phaseId,
 * task.dependencies) are remapped to the new ids; dangling ones are dropped or re-homed.
 */
function normalizeStructure(
  structured: AiStructuredInput,
  project: Project,
  base: Base,
  knownAssigneeIds: string[],
  existingPhases: Phase[]
): NormalizedStructure {
  const target = isDay(project.targetDeliveryDate) ? project.targetDeliveryDate : base.at.slice(0, 10);
  const orderOffset = existingPhases.reduce((max, p) => Math.max(max, num(p.order, 0)), 0);

  const phaseIdMap = new Map<string, string>();
  const phases: Phase[] = objArray(structured.phases).map((p, i) => {
    const id = newId('phase');
    const raw = str(p.id).trim();
    if (raw && !phaseIdMap.has(raw)) phaseIdMap.set(raw, id);
    const endDate = isDay(p.endDate) ? p.endDate : target;
    const startDate = isDay(p.startDate) ? p.startDate : endDate;
    return {
      id,
      name: str(p.name).trim() || `Phase ${orderOffset + i + 1}`,
      color: /^#[0-9a-fA-F]{6}$/.test(str(p.color)) ? str(p.color) : '#3B82F6',
      startDate,
      endDate,
      order: orderOffset + i + 1,
      bufferDays: num(p.bufferDays, 0),
      isCriticalPath: bool(p.isCriticalPath),
    };
  });

  const milestones: Milestone[] = objArray(structured.milestones)
    .filter((m) => str(m.title).trim())
    .map((m) => ({
      id: newId('ms'),
      title: str(m.title).trim(),
      targetDate: isDay(m.targetDate) ? m.targetDate : target,
      isHardDeadline: bool(m.isHardDeadline),
      completed: bool(m.completed),
      description: str(m.description),
      deliverableCount: num(m.deliverableCount, 0),
    }));

  const allPhases = [...existingPhases, ...phases];
  const allPhaseIds = new Set(allPhases.map((p) => p.id));
  const defaultPhaseId = phases[0]?.id ?? existingPhases[0]?.id ?? '';
  const assignees = new Set(knownAssigneeIds);

  const taskIdMap = new Map<string, string>();
  const rawTasks = objArray(structured.tasks).filter((t) => str(t.title).trim());
  const ids = rawTasks.map((t) => {
    const id = newId('task');
    const raw = str(t.id).trim();
    if (raw && !taskIdMap.has(raw)) taskIdMap.set(raw, id);
    return id;
  });
  const tasks: Task[] = rawTasks.map((t, i) => {
    const dueDate = isDay(t.dueDate) ? t.dueDate : target;
    const startDate = isDay(t.startDate) ? t.startDate : dueDate;
    const wantedPhase = str(t.phaseId).trim();
    const phaseId = phaseIdMap.get(wantedPhase) ?? (allPhaseIds.has(wantedPhase) ? wantedPhase : defaultPhaseId);
    const assigneeId = str(t.assigneeId);
    const checklist: TaskChecklistItem[] = objArray(t.checklist)
      .filter((c) => str(c.text).trim())
      .map((c) => ({ id: newId('c'), text: str(c.text).trim(), completed: bool(c.completed) }));
    return {
      id: ids[i],
      projectId: project.id,
      phaseId,
      title: str(t.title).trim(),
      description: str(t.description),
      status: oneOf(t.status, STATUSES, 'todo'),
      priority: oneOf(t.priority, PRIORITIES, 'medium'),
      assigneeId: assignees.has(assigneeId) ? assigneeId : base.actor.id,
      startDate,
      dueDate,
      estimatedHours: num(t.estimatedHours, 0),
      dependencies: strArray(t.dependencies)
        .map((d) => taskIdMap.get(d) ?? d)
        .filter((d) => d !== ids[i]),
      deliverables: strArray(t.deliverables),
      checklist,
      tags: strArray(t.tags),
      isCriticalPath: bool(t.isCriticalPath),
    };
  });
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.dependencies = t.dependencies.filter((d) => taskIds.has(d));

  const clarificationQuestions: ClarificationQuestion[] = objArray(structured.clarificationQuestions)
    .filter((q) => str(q.question).trim())
    .map((q) => ({
      id: newId('q'),
      question: str(q.question).trim(),
      reason: str(q.reason),
      suggestedOptions: strArray(q.suggestedOptions),
      resolved: bool(q.resolved),
      userResponse: typeof q.userResponse === 'string' ? q.userResponse : undefined,
    }));

  return { phases, milestones, tasks, clarificationQuestions };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reduceProject(project: Project, action: ProjectsAction): Project {
  switch (action.type) {
    case 'project/update':
      return { ...project, ...action.patch, id: project.id };

    case 'task/add': {
      const task = { ...action.task, projectId: project.id };
      return withHistory({ ...project, tasks: [...project.tasks, task] }, action, {
        actionType: 'create',
        targetType: 'task',
        targetTitle: task.title,
        description: `Added task "${task.title}".`,
      });
    }

    case 'task/update': {
      const existing = project.tasks.find((t) => t.id === action.task.id);
      if (!existing) return project;
      const task = { ...action.task, projectId: project.id };
      const next = { ...project, tasks: project.tasks.map((t) => (t.id === task.id ? task : t)) };
      if (existing.status !== task.status) {
        return withHistory(next, action, {
          actionType: 'status_change',
          targetType: 'task',
          targetTitle: task.title,
          description: `Changed status from ${existing.status} to ${task.status}.`,
          diff: { field: 'status', oldVal: existing.status, newVal: task.status },
        });
      }
      return withHistory(next, action, {
        actionType: 'update',
        targetType: 'task',
        targetTitle: task.title,
        description: `Updated task "${task.title}".`,
      });
    }

    case 'task/delete': {
      const task = project.tasks.find((t) => t.id === action.taskId);
      if (!task) return project;
      const tasks = project.tasks
        .filter((t) => t.id !== action.taskId)
        .map((t) => (t.dependencies.includes(action.taskId) ? { ...t, dependencies: t.dependencies.filter((d) => d !== action.taskId) } : t));
      return withHistory({ ...project, tasks }, action, {
        actionType: 'delete',
        targetType: 'task',
        targetTitle: task.title,
        description: `Removed task "${task.title}".`,
      });
    }

    case 'task/setStatus': {
      const task = project.tasks.find((t) => t.id === action.taskId);
      if (!task || task.status === action.status) return project;
      const next = { ...project, tasks: project.tasks.map((t) => (t.id === task.id ? { ...t, status: action.status } : t)) };
      return withHistory(next, action, {
        actionType: 'status_change',
        targetType: 'task',
        targetTitle: task.title,
        description: `Changed status from ${task.status} to ${action.status}.`,
        diff: { field: 'status', oldVal: task.status, newVal: action.status },
      });
    }

    case 'task/toggleChecklistItem': {
      const task = project.tasks.find((t) => t.id === action.taskId);
      if (!task) return project;
      const checklist = task.checklist.map((c) => (c.id === action.itemId ? { ...c, completed: !c.completed } : c));
      return { ...project, tasks: project.tasks.map((t) => (t.id === task.id ? { ...t, checklist } : t)) };
    }

    case 'phase/add': {
      const order = num(action.phase.order, 0) || project.phases.reduce((m, p) => Math.max(m, p.order), 0) + 1;
      const phase = { ...action.phase, order };
      return withHistory({ ...project, phases: [...project.phases, phase] }, action, {
        actionType: 'create',
        targetType: 'timeline',
        targetTitle: phase.name,
        description: `Added phase "${phase.name}" (${phase.startDate} to ${phase.endDate}).`,
      });
    }

    case 'phase/update': {
      const phase = project.phases.find((p) => p.id === action.phaseId);
      if (!phase) return project;
      const updated = { ...phase, ...action.patch, id: phase.id };
      const datesChanged = updated.startDate !== phase.startDate || updated.endDate !== phase.endDate;
      const next = { ...project, phases: project.phases.map((p) => (p.id === phase.id ? updated : p)) };
      return withHistory(next, action, {
        actionType: datesChanged ? 'retroplan_shift' : 'update',
        targetType: 'timeline',
        targetTitle: updated.name,
        description: datesChanged
          ? `Phase "${updated.name}" now runs ${updated.startDate} to ${updated.endDate}.`
          : `Updated phase "${updated.name}".`,
      });
    }

    case 'phase/delete': {
      const phase = project.phases.find((p) => p.id === action.phaseId);
      if (!phase) return project;
      const remaining = project.phases.filter((p) => p.id !== action.phaseId).sort((a, b) => a.order - b.order);
      const fallbackId = remaining[0]?.id ?? '';
      const moved = project.tasks.filter((t) => t.phaseId === action.phaseId).length;
      const tasks = project.tasks.map((t) => (t.phaseId === action.phaseId ? { ...t, phaseId: fallbackId } : t));
      return withHistory({ ...project, phases: remaining, tasks }, action, {
        actionType: 'delete',
        targetType: 'timeline',
        targetTitle: phase.name,
        description:
          moved > 0
            ? `Deleted phase "${phase.name}"; ${moved} task(s) moved to ${remaining[0] ? `"${remaining[0].name}"` : 'no phase'}.`
            : `Deleted phase "${phase.name}".`,
      });
    }

    case 'milestone/add': {
      const milestone = { ...action.milestone, completed: bool(action.milestone.completed) };
      return withHistory({ ...project, milestones: [...project.milestones, milestone] }, action, {
        actionType: 'create',
        targetType: 'milestone',
        targetTitle: milestone.title,
        description: `Created milestone "${milestone.title}" due ${milestone.targetDate}.`,
      });
    }

    case 'milestone/update': {
      const ms = project.milestones.find((m) => m.id === action.milestoneId);
      if (!ms) return project;
      const updated = { ...ms, ...action.patch, id: ms.id };
      const next = { ...project, milestones: project.milestones.map((m) => (m.id === ms.id ? updated : m)) };
      return withHistory(next, action, {
        actionType: 'update',
        targetType: 'milestone',
        targetTitle: updated.title,
        description: `Updated milestone "${updated.title}".`,
      });
    }

    case 'milestone/delete': {
      const ms = project.milestones.find((m) => m.id === action.milestoneId);
      if (!ms) return project;
      return withHistory({ ...project, milestones: project.milestones.filter((m) => m.id !== ms.id) }, action, {
        actionType: 'delete',
        targetType: 'milestone',
        targetTitle: ms.title,
        description: `Deleted milestone "${ms.title}".`,
      });
    }

    case 'milestone/toggle': {
      const ms = project.milestones.find((m) => m.id === action.milestoneId);
      if (!ms) return project;
      const completed = !ms.completed;
      const next = { ...project, milestones: project.milestones.map((m) => (m.id === ms.id ? { ...m, completed } : m)) };
      return withHistory(next, action, {
        actionType: 'status_change',
        targetType: 'milestone',
        targetTitle: ms.title,
        description: `Marked milestone "${ms.title}" as ${completed ? 'completed' : 'pending'}.`,
        diff: { field: 'completed', oldVal: String(ms.completed), newVal: String(completed) },
      });
    }

    case 'project/setTargetDeliveryDate': {
      const oldDate = project.targetDeliveryDate;
      if (!isDay(action.date) || action.date === oldDate) return project;
      if (action.mode === 'anchor-only') {
        return withHistory({ ...project, targetDeliveryDate: action.date }, action, {
          actionType: 'retroplan_shift',
          targetType: 'timeline',
          targetTitle: 'Target delivery date',
          description: `Target date changed from ${oldDate} to ${action.date}; schedule not moved.`,
          diff: { field: 'targetDeliveryDate', oldVal: oldDate, newVal: action.date },
        });
      }
      const delta = dayDiff(oldDate, action.date);
      if (delta === null) {
        // The previous target was not a valid date: nothing to compute a delta from.
        return withHistory({ ...project, targetDeliveryDate: action.date }, action, {
          actionType: 'retroplan_shift',
          targetType: 'timeline',
          targetTitle: 'Target delivery date',
          description: `Target date set to ${action.date}; previous target "${oldDate}" was not a date, schedule not moved.`,
          diff: { field: 'targetDeliveryDate', oldVal: oldDate, newVal: action.date },
        });
      }
      const next: Project = {
        ...project,
        targetDeliveryDate: action.date,
        startDate: shiftDay(project.startDate, delta),
        phases: project.phases.map((p) => ({ ...p, startDate: shiftDay(p.startDate, delta), endDate: shiftDay(p.endDate, delta) })),
        tasks: project.tasks.map((t) => ({ ...t, startDate: shiftDay(t.startDate, delta), dueDate: shiftDay(t.dueDate, delta) })),
        milestones: project.milestones.map((m) => ({ ...m, targetDate: shiftDay(m.targetDate, delta) })),
      };
      const sign = delta > 0 ? '+' : '';
      return withHistory(next, action, {
        actionType: 'retroplan_shift',
        targetType: 'timeline',
        targetTitle: 'Target delivery date',
        description: `Shifted all dates by ${sign}${delta} day${Math.abs(delta) === 1 ? '' : 's'} (target ${oldDate} to ${action.date}).`,
        diff: { field: 'targetDeliveryDate', oldVal: oldDate, newVal: action.date },
      });
    }

    case 'document/save': {
      const existing = project.documents.find((d) => d.id === action.doc.id);
      if (!existing) return project;
      const doc: MarkdownDoc = { ...action.doc, lastModified: action.at, lastModifiedBy: action.actor.name };
      const next = { ...project, documents: project.documents.map((d) => (d.id === doc.id ? doc : d)) };
      return withHistory(next, action, {
        actionType: 'update',
        targetType: 'document',
        targetTitle: doc.title,
        description: `Saved "${doc.title}".`,
      });
    }

    case 'document/create': {
      const doc: MarkdownDoc = { ...action.doc, lastModified: action.at, lastModifiedBy: action.actor.name };
      return withHistory({ ...project, documents: [doc, ...project.documents] }, action, {
        actionType: 'create',
        targetType: 'document',
        targetTitle: doc.title,
        description: `Created "${doc.title}".`,
      });
    }

    case 'document/delete': {
      const doc = project.documents.find((d) => d.id === action.docId);
      if (!doc) return project;
      const cloud = project.cloud
        ? {
            ...project.cloud,
            syncState: {
              ...project.cloud.syncState,
              deletedDocIds: [...(project.cloud.syncState.deletedDocIds ?? []), doc.id],
            },
          }
        : undefined;
      const next: Project = { ...project, documents: project.documents.filter((d) => d.id !== doc.id) };
      if (cloud) next.cloud = cloud;
      return withHistory(next, action, {
        actionType: 'delete',
        targetType: 'document',
        targetTitle: doc.title,
        description: `Deleted "${doc.title}".`,
      });
    }

    case 'document/import': {
      if (action.docs.length === 0) return project;
      const docs = action.docs.map((d) => ({ ...d, lastModified: d.lastModified || action.at, lastModifiedBy: d.lastModifiedBy || action.actor.name }));
      return withHistory({ ...project, documents: [...docs, ...project.documents] }, action, {
        actionType: 'create',
        targetType: 'document',
        targetTitle: docs.length === 1 ? docs[0].title : `${docs.length} documents`,
        description: `Imported ${docs.length} document${docs.length === 1 ? '' : 's'}.`,
      });
    }

    case 'project/applyAiStructure': {
      const existingPhases = action.replace ? [] : project.phases;
      const s = normalizeStructure(action.structured, project, action, action.knownAssigneeIds, existingPhases);
      const next: Project = action.replace
        ? {
            ...project,
            phases: s.phases,
            milestones: s.milestones,
            tasks: s.tasks,
            clarificationQuestions: s.clarificationQuestions,
          }
        : {
            ...project,
            phases: [...project.phases, ...s.phases],
            milestones: [...project.milestones, ...s.milestones],
            tasks: [...project.tasks, ...s.tasks],
            clarificationQuestions: [...project.clarificationQuestions, ...s.clarificationQuestions],
          };
      const summary = `${s.tasks.length} task(s), ${s.phases.length} phase(s), ${s.milestones.length} milestone(s)`;
      return withHistory(next, action, {
        actionType: 'ai_restructure',
        targetType: 'project',
        targetTitle: project.title,
        description: action.replace ? `AI plan applied, replacing the previous schedule: ${summary}.` : `AI plan merged into the schedule: ${summary} added.`,
      });
    }

    case 'comment/add': {
      const comment = { ...action.comment, timestamp: action.comment.timestamp || action.at };
      return withHistory({ ...project, comments: [comment, ...project.comments] }, action, {
        actionType: 'comment',
        targetType: comment.targetType,
        targetTitle: comment.targetType === 'project' ? project.title : comment.targetId,
        description: `${comment.authorName} commented: "${comment.content.slice(0, 80)}${comment.content.length > 80 ? '...' : ''}"`,
      });
    }

    case 'history/add':
      return withHistory(project, action, action.entry);

    case 'clarification/resolve': {
      const q = project.clarificationQuestions.find((c) => c.id === action.questionId);
      if (!q) return project;
      const next = {
        ...project,
        clarificationQuestions: project.clarificationQuestions.map((c) => (c.id === q.id ? { ...c, resolved: true, userResponse: action.response } : c)),
      };
      return withHistory(next, action, {
        actionType: 'update',
        targetType: 'project',
        targetTitle: q.question,
        description: `Resolved question: "${action.response}".`,
      });
    }

    case 'cloud/setLink': {
      const next = { ...project };
      if (action.link) next.cloud = action.link;
      else delete next.cloud;
      return next;
    }

    case 'cloud/applyPatch': {
      const next: Project = { ...project, ...(action.projectPatch ?? {}), id: project.id };
      if (action.documents) next.documents = action.documents;
      return next;
    }

    default:
      return project;
  }
}

/** Pure: returns a new array when something changed, the same array otherwise. */
export function projectsReducer(projects: Project[], action: ProjectsAction): Project[] {
  switch (action.type) {
    case 'project/create': {
      if (projects.some((p) => p.id === action.project.id)) return projects;
      const project = withHistory(action.project, action, {
        actionType: 'create',
        targetType: 'project',
        targetTitle: action.project.title,
        description: `Created project "${action.project.title}" targeting ${action.project.targetDeliveryDate}.`,
      });
      return [finalize(project, action.at), ...projects];
    }
    case 'project/delete':
      return projects.some((p) => p.id === action.projectId) ? projects.filter((p) => p.id !== action.projectId) : projects;
    case 'project/restore': {
      const idx = projects.findIndex((p) => p.id === action.project.id);
      const restored = finalize(action.project, action.at);
      if (idx === -1) return [restored, ...projects];
      return projects.map((p, i) => (i === idx ? restored : p));
    }
    default: {
      const idx = projects.findIndex((p) => p.id === action.projectId);
      if (idx === -1) return projects;
      const current = projects[idx];
      const next = reduceProject(current, action);
      if (next === current) return projects;
      const done = action.type === 'cloud/setLink' || action.type === 'cloud/applyPatch' ? next : finalize(next, action.at);
      return projects.map((p, i) => (i === idx ? done : p));
    }
  }
}

// ---------------------------------------------------------------------------
// Action creators
// ---------------------------------------------------------------------------

interface Ctx {
  projectId: string;
  actor: Actor;
  at?: string;
}

function base(ctx: Ctx): Base {
  return { projectId: ctx.projectId, actor: ctx.actor, at: ctx.at ?? new Date().toISOString() };
}

export const projectsActions = {
  createProject: (ctx: Ctx, project: Project): ProjectsAction => ({ type: 'project/create', project, ...base(ctx) }),
  updateProject: (ctx: Ctx, patch: Partial<Project>): ProjectsAction => ({ type: 'project/update', patch, ...base(ctx) }),
  deleteProject: (ctx: Ctx): ProjectsAction => ({ type: 'project/delete', ...base(ctx) }),
  restoreProject: (ctx: Ctx, project: Project): ProjectsAction => ({ type: 'project/restore', project, ...base(ctx) }),
  addTask: (ctx: Ctx, task: Task): ProjectsAction => ({ type: 'task/add', task, ...base(ctx) }),
  updateTask: (ctx: Ctx, task: Task): ProjectsAction => ({ type: 'task/update', task, ...base(ctx) }),
  deleteTask: (ctx: Ctx, taskId: string): ProjectsAction => ({ type: 'task/delete', taskId, ...base(ctx) }),
  setTaskStatus: (ctx: Ctx, taskId: string, status: TaskStatus): ProjectsAction => ({ type: 'task/setStatus', taskId, status, ...base(ctx) }),
  toggleChecklistItem: (ctx: Ctx, taskId: string, itemId: string): ProjectsAction => ({ type: 'task/toggleChecklistItem', taskId, itemId, ...base(ctx) }),
  addPhase: (ctx: Ctx, phase: Phase): ProjectsAction => ({ type: 'phase/add', phase, ...base(ctx) }),
  updatePhase: (ctx: Ctx, phaseId: string, patch: Partial<Phase>): ProjectsAction => ({ type: 'phase/update', phaseId, patch, ...base(ctx) }),
  deletePhase: (ctx: Ctx, phaseId: string): ProjectsAction => ({ type: 'phase/delete', phaseId, ...base(ctx) }),
  addMilestone: (ctx: Ctx, milestone: Milestone): ProjectsAction => ({ type: 'milestone/add', milestone, ...base(ctx) }),
  updateMilestone: (ctx: Ctx, milestoneId: string, patch: Partial<Milestone>): ProjectsAction => ({ type: 'milestone/update', milestoneId, patch, ...base(ctx) }),
  deleteMilestone: (ctx: Ctx, milestoneId: string): ProjectsAction => ({ type: 'milestone/delete', milestoneId, ...base(ctx) }),
  toggleMilestone: (ctx: Ctx, milestoneId: string): ProjectsAction => ({ type: 'milestone/toggle', milestoneId, ...base(ctx) }),
  setTargetDeliveryDate: (ctx: Ctx, date: string, mode: TargetDateMode): ProjectsAction => ({ type: 'project/setTargetDeliveryDate', date, mode, ...base(ctx) }),
  saveDocument: (ctx: Ctx, doc: MarkdownDoc): ProjectsAction => ({ type: 'document/save', doc, ...base(ctx) }),
  createDocument: (ctx: Ctx, doc: MarkdownDoc): ProjectsAction => ({ type: 'document/create', doc, ...base(ctx) }),
  deleteDocument: (ctx: Ctx, docId: string): ProjectsAction => ({ type: 'document/delete', docId, ...base(ctx) }),
  importDocuments: (ctx: Ctx, docs: MarkdownDoc[]): ProjectsAction => ({ type: 'document/import', docs, ...base(ctx) }),
  applyAiStructure: (ctx: Ctx, structured: AiStructuredInput, options: { replace: boolean; knownAssigneeIds?: string[] }): ProjectsAction => ({
    type: 'project/applyAiStructure',
    structured,
    replace: options.replace,
    knownAssigneeIds: options.knownAssigneeIds ?? [ctx.actor.id],
    ...base(ctx),
  }),
  addComment: (ctx: Ctx, comment: Comment): ProjectsAction => ({ type: 'comment/add', comment, ...base(ctx) }),
  addHistory: (ctx: Ctx, entry: HistoryInput): ProjectsAction => ({ type: 'history/add', entry, ...base(ctx) }),
  resolveClarification: (ctx: Ctx, questionId: string, response: string): ProjectsAction => ({ type: 'clarification/resolve', questionId, response, ...base(ctx) }),
  setCloudLink: (ctx: Ctx, link: ProjectCloudLink | null): ProjectsAction => ({ type: 'cloud/setLink', link, ...base(ctx) }),
  applyCloudPatch: (ctx: Ctx, patch: { documents?: MarkdownDoc[]; projectPatch?: Partial<Project> }): ProjectsAction => ({
    type: 'cloud/applyPatch',
    documents: patch.documents,
    projectPatch: patch.projectPatch,
    ...base(ctx),
  }),
};
