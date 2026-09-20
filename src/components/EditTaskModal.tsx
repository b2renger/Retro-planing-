import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useActiveProject, useApp } from '../context/AppContext';
import type { TaskPriority, TaskStatus } from '../types';
import { Modal } from './ui/Modal';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from './taskFields';
import { ChecklistEditor } from './editTask/ChecklistEditor';
import { ChipEditor } from './editTask/ChipEditor';
import { DependencyPicker } from './editTask/DependencyPicker';
import { applyDraft, toDraft, validateDraft, type TaskDraft } from './editTask/draft';

const FORM_ID = 'edit-task-form';
const FIELD =
  'w-full rounded-xl border border-line bg-input px-3 py-2 text-fg placeholder-fg-subtle focus:border-purple-500 focus:outline-none';
const LABEL = 'mb-1 block font-semibold text-fg-muted';

/**
 * Edit an existing task — the app had create-only until now. Bound to `editingTaskId`, so the
 * board, the triage list and the timeline inspector all open this same dialog. Delete asks for
 * confirmation and goes through `deleteTask`, which the facade snapshots, so `undo` restores it.
 */
export const EditTaskModal: React.FC = () => {
  const { editingTaskId, setEditingTaskId, updateTask, deleteTask, teamMembers } = useApp();
  const project = useActiveProject();
  const task = editingTaskId ? project.tasks.find((t) => t.id === editingTaskId) ?? null : null;
  const taskId = task?.id ?? null;

  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(taskId && task ? toDraft(task) : null);
    setConfirmDelete(false);
    // Re-seed only when another task is opened; typing must not be overwritten by re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const close = (): void => setEditingTaskId(null);

  if (!task || !draft) return <Modal open={false} onClose={close} title="Edit task" />;

  const patch = (change: Partial<TaskDraft>): void => setDraft((d) => (d ? { ...d, ...change } : d));
  const validation = validateDraft(draft, project);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (validation.blocking) return;
    updateTask(applyDraft(task, draft));
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title="Edit task"
      icon={<Pencil className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />}
      subtitle={task.title}
      size="2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-rose-700 dark:text-rose-300">Delete this task?</span>
              <button
                type="button"
                onClick={() => {
                  deleteTask(task.id);
                  close();
                }}
                className="rounded-xl bg-rose-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-rose-500"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-fg-muted hover:text-fg"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete task
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl bg-elevated px-3.5 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-line"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={FORM_ID}
              disabled={validation.blocking}
              className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
            >
              Save changes
            </button>
          </div>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-3.5 text-xs">
        <div>
          <label className={LABEL} htmlFor="edit-task-title">
            Title
          </label>
          <input
            id="edit-task-title"
            type="text"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            className={FIELD}
          />
          {validation.title && <p className="mt-1 text-rose-600 dark:text-rose-400">{validation.title}</p>}
        </div>

        <div>
          <label className={LABEL} htmlFor="edit-task-description">
            Description
          </label>
          <textarea
            id="edit-task-description"
            rows={2}
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            className={`${FIELD} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="edit-task-phase">
              Phase
            </label>
            <select
              id="edit-task-phase"
              value={draft.phaseId}
              onChange={(e) => patch({ phaseId: e.target.value })}
              className={FIELD}
            >
              <option value="">No phase</option>
              {project.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="edit-task-assignee">
              Assignee
            </label>
            <select
              id="edit-task-assignee"
              value={draft.assigneeId}
              onChange={(e) => patch({ assigneeId: e.target.value })}
              className={FIELD}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL} htmlFor="edit-task-status">
              Status
            </label>
            <select
              id="edit-task-status"
              value={draft.status}
              onChange={(e) => patch({ status: e.target.value as TaskStatus })}
              className={FIELD}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="edit-task-priority">
              Priority
            </label>
            <select
              id="edit-task-priority"
              value={draft.priority}
              onChange={(e) => patch({ priority: e.target.value as TaskPriority })}
              className={FIELD}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="edit-task-start">
              Start
            </label>
            <input
              id="edit-task-start"
              type="date"
              value={draft.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="edit-task-due">
              Due
            </label>
            <input
              id="edit-task-due"
              type="date"
              value={draft.dueDate}
              onChange={(e) => patch({ dueDate: e.target.value })}
              className={FIELD}
            />
          </div>
        </div>
        {validation.dates && <p className="text-rose-600 dark:text-rose-400">{validation.dates}</p>}
        {validation.warning && <p className="text-amber-700 dark:text-amber-300">{validation.warning}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="edit-task-hours">
              Estimated hours
            </label>
            <input
              id="edit-task-hours"
              type="number"
              min="0"
              step="1"
              value={draft.estimatedHours}
              onChange={(e) => patch({ estimatedHours: e.target.value })}
              className={FIELD}
            />
            {validation.hours && <p className="mt-1 text-rose-600 dark:text-rose-400">{validation.hours}</p>}
          </div>
          <ChipEditor
            id="edit-task-deliverables"
            title="Deliverables"
            placeholder="Add a deliverable, then Enter"
            values={draft.deliverables}
            onChange={(deliverables) => patch({ deliverables })}
          />
        </div>

        <ChipEditor
          id="edit-task-tags"
          title="Tags"
          placeholder="Add a tag, then Enter"
          values={draft.tags}
          onChange={(tags) => patch({ tags })}
        />

        <ChecklistEditor items={draft.checklist} onChange={(checklist) => patch({ checklist })} />

        <DependencyPicker
          tasks={project.tasks}
          taskId={task.id}
          selected={draft.dependencies}
          onChange={(dependencies) => patch({ dependencies })}
        />
      </form>
    </Modal>
  );
};
