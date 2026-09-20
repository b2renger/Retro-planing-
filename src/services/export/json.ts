/**
 * JSON export/import of a whole project, with validation on the way in so a hand-edited or
 * foreign file cannot smuggle malformed data into the app state.
 */
import type {
  ClarificationQuestion,
  Comment,
  HistoryEntry,
  MarkdownDoc,
  Milestone,
  Phase,
  Project,
  Task,
  TaskChecklistItem,
  TaskPriority,
  TaskStatus,
} from '../../types';

/** Error thrown by `parseProjectJson` with a human-readable path to the offending field. */
export class ProjectJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectJsonError';
  }
}

/** Serialises a project as pretty-printed JSON (2-space indent). */
export function projectToJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in-progress', 'in-review', 'blocked', 'done'];
const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const PROJECT_STATUSES: readonly Project['status'][] = ['on-track', 'at-risk', 'in-review', 'completed'];

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(path: string, expectation: string): never {
  throw new ProjectJsonError(`Invalid project JSON: "${path}" ${expectation}`);
}

function requireString(obj: Json, key: string, path: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) fail(`${path}.${key}`, 'must be a non-empty string');
  return v;
}

function optString(obj: Json, key: string, path: string, fallback = ''): string {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string') fail(`${path}.${key}`, 'must be a string');
  return v;
}

function optNumber(obj: Json, key: string, path: string, fallback: number): number {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'must be a finite number');
  return v;
}

function optBoolean(obj: Json, key: string, path: string, fallback: boolean): boolean {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') fail(`${path}.${key}`, 'must be a boolean');
  return v;
}

function optEnum<T extends string>(obj: Json, key: string, path: string, allowed: readonly T[], fallback: T): T {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    fail(`${path}.${key}`, `must be one of ${allowed.join(', ')}`);
  }
  return v as T;
}

function optArray(obj: Json, key: string, path: string): unknown[] {
  const v = obj[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) fail(`${path}.${key}`, 'must be an array');
  return v;
}

function stringArray(obj: Json, key: string, path: string): string[] {
  return optArray(obj, key, path).map((item, i) => {
    if (typeof item !== 'string') fail(`${path}.${key}[${i}]`, 'must be a string');
    return item;
  });
}

function objectArray<T>(obj: Json, key: string, path: string, parse: (item: Json, itemPath: string, index: number) => T): T[] {
  return optArray(obj, key, path).map((item, i) => {
    const itemPath = `${path}.${key}[${i}]`;
    if (!isObject(item)) fail(itemPath, 'must be an object');
    return parse(item, itemPath, i);
  });
}

function parseChecklistItem(item: Json, path: string): TaskChecklistItem {
  return {
    id: requireString(item, 'id', path),
    text: optString(item, 'text', path),
    completed: optBoolean(item, 'completed', path, false),
  };
}

function parseTask(item: Json, path: string, projectId: string): Task {
  const task: Task = {
    id: requireString(item, 'id', path),
    projectId: optString(item, 'projectId', path, projectId),
    phaseId: optString(item, 'phaseId', path),
    title: requireString(item, 'title', path),
    description: optString(item, 'description', path),
    status: optEnum(item, 'status', path, TASK_STATUSES, 'todo'),
    priority: optEnum(item, 'priority', path, TASK_PRIORITIES, 'medium'),
    assigneeId: optString(item, 'assigneeId', path),
    startDate: optString(item, 'startDate', path),
    dueDate: optString(item, 'dueDate', path),
    estimatedHours: optNumber(item, 'estimatedHours', path, 0),
    dependencies: stringArray(item, 'dependencies', path),
    deliverables: stringArray(item, 'deliverables', path),
    checklist: objectArray(item, 'checklist', path, parseChecklistItem),
    tags: stringArray(item, 'tags', path),
  };
  if (item.actualHours !== undefined && item.actualHours !== null) task.actualHours = optNumber(item, 'actualHours', path, 0);
  if (item.markdownRef !== undefined && item.markdownRef !== null) task.markdownRef = optString(item, 'markdownRef', path);
  if (item.isCriticalPath !== undefined && item.isCriticalPath !== null) {
    task.isCriticalPath = optBoolean(item, 'isCriticalPath', path, false);
  }
  return task;
}

function parsePhase(item: Json, path: string, index: number): Phase {
  return {
    id: requireString(item, 'id', path),
    name: requireString(item, 'name', path),
    color: optString(item, 'color', path, '#9CA3AF'),
    startDate: optString(item, 'startDate', path),
    endDate: optString(item, 'endDate', path),
    order: optNumber(item, 'order', path, index + 1),
    bufferDays: optNumber(item, 'bufferDays', path, 0),
    isCriticalPath: optBoolean(item, 'isCriticalPath', path, false),
  };
}

function parseMilestone(item: Json, path: string): Milestone {
  return {
    id: requireString(item, 'id', path),
    title: requireString(item, 'title', path),
    targetDate: optString(item, 'targetDate', path),
    isHardDeadline: optBoolean(item, 'isHardDeadline', path, false),
    completed: optBoolean(item, 'completed', path, false),
    description: optString(item, 'description', path),
    deliverableCount: optNumber(item, 'deliverableCount', path, 0),
  };
}

function parseDocument(item: Json, path: string): MarkdownDoc {
  const doc: MarkdownDoc = {
    id: requireString(item, 'id', path),
    title: optString(item, 'title', path),
    path: optString(item, 'path', path),
    content: optString(item, 'content', path),
    lastModified: optString(item, 'lastModified', path),
    lastModifiedBy: optString(item, 'lastModifiedBy', path),
    tags: stringArray(item, 'tags', path),
  };
  if (typeof item.autoStructured === 'boolean') doc.autoStructured = item.autoStructured;
  if (Array.isArray(item.linkedTaskIds)) doc.linkedTaskIds = stringArray(item, 'linkedTaskIds', path);
  if (isObject(item.yamlFrontmatter)) doc.yamlFrontmatter = item.yamlFrontmatter;
  return doc;
}

/** Entities whose fields are free-form: only `id` is enforced, the rest passes through. */
function parseLoose<T extends { id: string }>(item: Json, path: string): T {
  requireString(item, 'id', path);
  return item as unknown as T;
}

/**
 * Parses and validates a project exported by `projectToJson` (a `{ project: ... }` envelope is
 * also accepted). Required: `id`, `title`, and an `id` + title/name on every phase, task and
 * milestone. Optional scalars get sensible defaults, arrays default to `[]`, enum fields are
 * checked. Throws `ProjectJsonError` with the path of the first invalid field.
 */
export function parseProjectJson(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ProjectJsonError(`Invalid project JSON: ${err instanceof Error ? err.message : 'unparseable input'}`);
  }
  if (isObject(raw) && isObject(raw.project) && !('tasks' in raw)) raw = raw.project;
  if (!isObject(raw)) fail('$', 'must be an object');
  const p = raw;
  const path = '$';
  const id = requireString(p, 'id', path);

  const project: Project = {
    id,
    workspaceId: optString(p, 'workspaceId', path),
    title: requireString(p, 'title', path),
    clientName: optString(p, 'clientName', path),
    description: optString(p, 'description', path),
    status: optEnum(p, 'status', path, PROJECT_STATUSES, 'on-track'),
    targetDeliveryDate: optString(p, 'targetDeliveryDate', path),
    startDate: optString(p, 'startDate', path),
    phases: objectArray(p, 'phases', path, parsePhase),
    tasks: objectArray(p, 'tasks', path, (item, itemPath) => parseTask(item, itemPath, id)),
    milestones: objectArray(p, 'milestones', path, parseMilestone),
    documents: objectArray(p, 'documents', path, parseDocument),
    history: objectArray(p, 'history', path, (item, itemPath) => parseLoose<HistoryEntry>(item, itemPath)),
    comments: objectArray(p, 'comments', path, (item, itemPath) => parseLoose<Comment>(item, itemPath)),
    clarificationQuestions: objectArray(p, 'clarificationQuestions', path, (item, itemPath) =>
      parseLoose<ClarificationQuestion>(item, itemPath)
    ),
    retroplanningScore: optNumber(p, 'retroplanningScore', path, 0),
    tags: stringArray(p, 'tags', path),
  };

  // Optional blocks pass through untouched when present (validated by their own editors).
  const passthrough: (keyof Project)[] = [
    'hardwareItems',
    'mediaAssets',
    'driveSynced',
    'driveFolderId',
    'driveFolderName',
    'driveFolderUrl',
    'driveLastSyncedAt',
    'driveSyncStatus',
    'isTutorialTemplate',
  ];
  for (const key of passthrough) {
    if (p[key] !== undefined) (project as unknown as Json)[key] = p[key];
  }
  return project;
}
