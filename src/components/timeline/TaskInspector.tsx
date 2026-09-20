import React from 'react';
import { AlertTriangle, Flame, Link2, Lock, Pencil } from 'lucide-react';
import type { Project, TaskStatus, User } from '../../types';
import { Modal } from '../ui/Modal';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from '../taskFields';
import { dependencyLinks } from './dependencies';
import { formatDay } from './scale';

export interface TaskInspectorProps {
  project: Project;
  /** Selected id — the task itself is always re-read from the project, never cached. */
  taskId: string | null;
  teamMembers: readonly User[];
  locale: string;
  criticalIds: ReadonlySet<string>;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onToggleChecklistItem: (taskId: string, itemId: string) => void;
  onEdit: (taskId: string) => void;
}

/** Read-only inspector for one task. Everything it shows comes from the live project. */
export const TaskInspector: React.FC<TaskInspectorProps> = ({
  project,
  taskId,
  teamMembers,
  locale,
  criticalIds,
  onClose,
  onStatusChange,
  onToggleChecklistItem,
  onEdit,
}) => {
  const task = taskId ? project.tasks.find((t) => t.id === taskId) ?? null : null;
  const phase = task ? project.phases.find((p) => p.id === task.phaseId) ?? null : null;
  const assignee = task ? teamMembers.find((m) => m.id === task.assigneeId) ?? null : null;
  const computedCritical = task ? criticalIds.has(task.id) : false;
  const incoming = task
    ? dependencyLinks(project.tasks).filter((l) => l.successorId === task.id)
    : [];
  const done = task ? task.checklist.filter((c) => c.completed).length : 0;

  return (
    <Modal
      open={Boolean(task)}
      onClose={onClose}
      title={task?.title ?? ''}
      subtitle={
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          Deliverable inspector{phase ? ` · ${phase.name}` : ''}
        </span>
      }
      size="lg"
      bodyClassName="overflow-y-auto px-5 py-4 space-y-4"
      footer={
        task ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
              Status
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                className="rounded-lg border border-line bg-input px-2.5 py-1 text-xs text-fg focus:outline-none"
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(task.id)}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit task
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-elevated px-3.5 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-line"
              >
                Close
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {task && (
        <>
          {task.description && <p className="text-xs leading-relaxed text-fg-muted">{task.description}</p>}

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-elevated p-3 text-xs">
            <div>
              <dt className="block text-[10px] text-fg-muted">Start</dt>
              <dd className="font-mono font-semibold text-fg">
                {formatDay(task.startDate, locale, { dateStyle: 'medium' })}
              </dd>
            </div>
            <div>
              <dt className="block text-[10px] text-fg-muted">Due</dt>
              <dd className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                {formatDay(task.dueDate, locale, { dateStyle: 'medium' })}
              </dd>
            </div>
            <div>
              <dt className="block text-[10px] text-fg-muted">Estimate</dt>
              <dd className="font-mono font-semibold text-purple-700 dark:text-purple-300">
                {task.estimatedHours}h
              </dd>
            </div>
            <div>
              <dt className="block text-[10px] text-fg-muted">Priority</dt>
              <dd className="font-semibold text-fg">{TASK_PRIORITY_LABELS[task.priority]}</dd>
            </div>
            <div>
              <dt className="block text-[10px] text-fg-muted">Assignee</dt>
              <dd className="font-semibold text-fg">{assignee?.name ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="block text-[10px] text-fg-muted">Critical path</dt>
              <dd className="flex flex-wrap items-center gap-2 font-semibold">
                {computedCritical ? (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <Flame className="h-3 w-3" /> Computed
                  </span>
                ) : (
                  <span className="text-fg-muted">Not on the computed path</span>
                )}
                {task.isCriticalPath && (
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" /> Manually flagged
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {incoming.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-[10px] font-semibold text-fg-muted">
                <Link2 className="h-3 w-3" /> Depends on
              </h4>
              <ul className="space-y-1">
                {incoming.map((link) => {
                  const pred = project.tasks.find((t) => t.id === link.predecessorId);
                  if (!pred) return null;
                  return (
                    <li
                      key={link.predecessorId}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                        link.violation
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          : 'border-line bg-elevated text-fg'
                      }`}
                    >
                      <span className="truncate">{pred.title}</span>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px]">
                        {link.violation && <AlertTriangle className="h-3 w-3" />}
                        ends {formatDay(pred.dueDate, locale, { day: 'numeric', month: 'short' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {incoming.some((l) => l.violation) && (
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  A predecessor finishes after this task starts. The schedule cannot be executed as drawn.
                </p>
              )}
            </section>
          )}

          {task.deliverables.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="text-[10px] font-semibold text-fg-muted">Deliverables</h4>
              <ul className="flex flex-wrap gap-1.5">
                {task.deliverables.map((d) => (
                  <li key={d} className="rounded-full border border-line bg-elevated px-2 py-0.5 text-[11px] text-fg">
                    {d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {task.checklist.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="text-[10px] font-semibold text-fg-muted">
                Checklist · {done}/{task.checklist.length}
              </h4>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {task.checklist.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onToggleChecklistItem(task.id, item.id)}
                      className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-xs text-fg-muted hover:bg-elevated"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        tabIndex={-1}
                        className="pointer-events-none rounded border-line-strong bg-input text-purple-600"
                      />
                      <span className={item.completed ? 'text-fg-subtle line-through' : ''}>{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {task.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <li key={tag} className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-fg-muted">
                  #{tag}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
};
