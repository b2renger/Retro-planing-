/**
 * Task dependency helpers: the links the timeline draws as arrows, the scheduling violations
 * it flags, and the cycle guard the edit modal uses to keep the dependency graph acyclic.
 */
import type { Task } from '../../types';

/** One finish-to-start dependency edge between two known tasks. */
export interface DependencyLink {
  /** The task that must finish first (the id listed in `successor.dependencies`). */
  predecessorId: string;
  successorId: string;
  /** True when the predecessor's due date is after the successor's start date. */
  violation: boolean;
}

/**
 * Every dependency edge of the project, de-duplicated, with unknown ids and self-references
 * dropped. A link is a `violation` when the predecessor ends after its successor starts — the
 * schedule cannot be executed as drawn.
 */
export function dependencyLinks(tasks: readonly Task[]): DependencyLink[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const links: DependencyLink[] = [];
  for (const task of tasks) {
    for (const depId of task.dependencies ?? []) {
      if (depId === task.id) continue;
      const pred = byId.get(depId);
      if (!pred) continue;
      const key = `${depId}->${task.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        predecessorId: depId,
        successorId: task.id,
        violation: Boolean(pred.dueDate && task.startDate && pred.dueDate > task.startDate),
      });
    }
  }
  return links;
}

/** Can `target` be reached from `startId` by walking `dependencies` edges? Cycle-safe. */
function reaches(byId: Map<string, Task>, startId: string, target: string): boolean {
  const stack = [startId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of byId.get(id)?.dependencies ?? []) {
      if (!seen.has(dep)) stack.push(dep);
    }
  }
  return false;
}

/**
 * Would making `taskId` depend on `candidateId` close a loop? True for a self-reference and
 * whenever `candidateId` already depends (directly or transitively) on `taskId`.
 */
export function wouldCreateCycle(tasks: readonly Task[], taskId: string, candidateId: string): boolean {
  if (taskId === candidateId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (!byId.has(candidateId)) return false;
  return reaches(byId, candidateId, taskId);
}

/**
 * The tasks `taskId` may legally depend on: every other task in the project except the ones
 * that would create a cycle. Already-selected dependencies stay in the list so a form can
 * render them as checked.
 */
export function dependencyCandidates(tasks: readonly Task[], taskId: string): Task[] {
  const current = new Set(tasks.find((t) => t.id === taskId)?.dependencies ?? []);
  return tasks.filter((t) => t.id !== taskId && (current.has(t.id) || !wouldCreateCycle(tasks, taskId, t.id)));
}
