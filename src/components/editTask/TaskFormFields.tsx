import React from 'react';
import type { Project, TaskPriority, TaskStatus, User } from '../../types';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from '../taskFields';
import { ChecklistEditor } from './ChecklistEditor';
import { ChipEditor } from './ChipEditor';
import { DependencyPicker } from './DependencyPicker';
import type { DraftValidation, TaskDraft } from './draft';

const FIELD =
  'w-full rounded-xl border border-line bg-input px-3 py-2 text-fg placeholder-fg-subtle focus:border-purple-500 focus:outline-none';
const LABEL = 'mb-1 block font-semibold text-fg-muted';

export interface TaskFormFieldsProps {
  formId: string;
  draft: TaskDraft;
  patch: (change: Partial<TaskDraft>) => void;
  project: Project;
  teamMembers: User[];
  validation: DraftValidation;
  /** False until a create form has been submitted once, so a blank form is not shouted at. */
  showErrors: boolean;
  /** The task being edited; absent while creating (nothing can depend on a task that has no id). */
  taskId?: string;
  onSubmit: (event: React.FormEvent) => void;
}

const FieldError: React.FC<{ show: boolean; message: string | null; className?: string }> = ({ show, message, className = '' }) =>
  show && message ? <p className={`text-rose-600 dark:text-rose-400 ${className}`}>{message}</p> : null;

/** The task form itself, shared by the create and edit modes of `TaskModal`. */
export const TaskFormFields: React.FC<TaskFormFieldsProps> = ({
  formId,
  draft,
  patch,
  project,
  teamMembers,
  validation,
  showErrors,
  taskId,
  onSubmit,
}) => (
  <form id={formId} onSubmit={onSubmit} className="space-y-3.5 text-xs">
    <div>
      <label className={LABEL} htmlFor="task-title">
        Title
      </label>
      <input id="task-title" type="text" value={draft.title} onChange={(e) => patch({ title: e.target.value })} className={FIELD} />
      <FieldError show={showErrors} message={validation.title} className="mt-1" />
    </div>

    <div>
      <label className={LABEL} htmlFor="task-description">
        Description
      </label>
      <textarea
        id="task-description"
        rows={2}
        value={draft.description}
        onChange={(e) => patch({ description: e.target.value })}
        className={`${FIELD} resize-none`}
      />
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={LABEL} htmlFor="task-phase">
          Phase
        </label>
        <select id="task-phase" value={draft.phaseId} onChange={(e) => patch({ phaseId: e.target.value })} className={FIELD}>
          <option value="">No phase</option>
          {project.phases.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL} htmlFor="task-assignee">
          Assignee
        </label>
        <select id="task-assignee" value={draft.assigneeId} onChange={(e) => patch({ assigneeId: e.target.value })} className={FIELD}>
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
        <label className={LABEL} htmlFor="task-status">
          Status
        </label>
        <select
          id="task-status"
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
        <label className={LABEL} htmlFor="task-priority">
          Priority
        </label>
        <select
          id="task-priority"
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
        <label className={LABEL} htmlFor="task-start">
          Start
        </label>
        <input
          id="task-start"
          type="date"
          value={draft.startDate}
          onChange={(e) => patch({ startDate: e.target.value })}
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="task-due">
          Due
        </label>
        <input id="task-due" type="date" value={draft.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} className={FIELD} />
      </div>
    </div>
    <FieldError show={showErrors} message={validation.dates} />
    {validation.warning && <p className="text-amber-700 dark:text-amber-300">{validation.warning}</p>}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={LABEL} htmlFor="task-hours">
          Estimated hours
        </label>
        <input
          id="task-hours"
          type="number"
          min="0"
          step="1"
          value={draft.estimatedHours}
          onChange={(e) => patch({ estimatedHours: e.target.value })}
          className={FIELD}
        />
        <FieldError show={showErrors} message={validation.hours} className="mt-1" />
      </div>
      <ChipEditor
        id="task-deliverables"
        title="Deliverables"
        placeholder="Add a deliverable, then Enter"
        values={draft.deliverables}
        onChange={(deliverables) => patch({ deliverables })}
      />
    </div>

    <ChipEditor
      id="task-tags"
      title="Tags"
      placeholder="Add a tag, then Enter"
      values={draft.tags}
      onChange={(tags) => patch({ tags })}
    />

    <ChecklistEditor items={draft.checklist} onChange={(checklist) => patch({ checklist })} />

    <DependencyPicker
      tasks={project.tasks}
      taskId={taskId ?? ''}
      selected={draft.dependencies}
      onChange={(dependencies) => patch({ dependencies })}
    />
  </form>
);
