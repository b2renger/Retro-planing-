import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useActiveProject, useApp } from '../context/AppContext';
import { Modal } from './ui/Modal';
import { TaskFormFields } from './editTask/TaskFormFields';
import { applyDraft, draftToNewTask, emptyDraft, toDraft, validateDraft, type TaskDraft } from './editTask/draft';

const FORM_ID = 'task-form';

type Mode = 'create' | 'edit';

/**
 * One task form for both creating and editing — same fields, same validation, same shell. Create is
 * bound to `isCreateTaskModalOpen`, edit to `editingTaskId`; an open editor wins if both are set.
 *
 * The draft is re-seeded every time the dialog opens, which is what keeps a new task in the *current*
 * project's first phase: the previous create modal held its `phaseId` from app mount, so after
 * switching project it produced tasks with a foreign phase id that appeared in no lane at all.
 */
export const TaskModal: React.FC = () => {
  const {
    editingTaskId,
    setEditingTaskId,
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    addTask,
    updateTask,
    deleteTask,
    teamMembers,
  } = useApp();
  const project = useActiveProject();

  const task = editingTaskId ? (project.tasks.find((t) => t.id === editingTaskId) ?? null) : null;
  const mode: Mode | null = task ? 'edit' : isCreateTaskModalOpen ? 'create' : null;
  const seed = task ? task.id : mode === 'create' ? `create:${project.id}` : null;

  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setDraft(task ? toDraft(task) : mode === 'create' ? emptyDraft(project) : null);
    setConfirmDelete(false);
    setAttempted(false);
    // Re-seed only when another task (or a fresh create) is opened; typing must survive re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const close = (): void => {
    setEditingTaskId(null);
    setIsCreateTaskModalOpen(false);
  };

  if (!mode || !draft) return <Modal open={false} onClose={close} title="Task" />;

  const patch = (change: Partial<TaskDraft>): void => setDraft((d) => (d ? { ...d, ...change } : d));
  const validation = validateDraft(draft, project);
  const creating = mode === 'create';

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setAttempted(true);
    if (validation.blocking) return;
    if (creating) addTask(draftToNewTask(draft, project.id));
    else if (task) updateTask(applyDraft(task, draft));
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title={creating ? 'New task' : 'Edit task'}
      icon={
        creating ? (
          <Plus className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
        ) : (
          <Pencil className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
        )
      }
      subtitle={creating ? project.title : task?.title}
      size="2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!creating && task && (confirmDelete ? (
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
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-fg-muted hover:text-fg">
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
          ))}
          <div className="ml-auto flex items-center gap-2">
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
              disabled={!creating && validation.blocking}
              className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
            >
              {creating ? 'Create task' : 'Save changes'}
            </button>
          </div>
        </div>
      }
    >
      <TaskFormFields
        formId={FORM_ID}
        draft={draft}
        patch={patch}
        project={project}
        teamMembers={teamMembers}
        validation={validation}
        showErrors={attempted || !creating}
        taskId={task?.id}
        onSubmit={submit}
      />
    </Modal>
  );
};
