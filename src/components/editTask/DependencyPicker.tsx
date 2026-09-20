import React, { useMemo } from 'react';
import type { Task } from '../../types';
import { wouldCreateCycle } from '../timeline/dependencies';

export interface DependencyPickerProps {
  /** Every task of the project, including the one being edited. */
  tasks: readonly Task[];
  taskId: string;
  selected: readonly string[];
  onChange: (dependencies: string[]) => void;
}

/**
 * Multi-select of the tasks this one depends on. Options that would close a dependency cycle
 * — checked against the pending selection, not just what is stored — are disabled and say why.
 */
export const DependencyPicker: React.FC<DependencyPickerProps> = ({ tasks, taskId, selected, onChange }) => {
  const options = useMemo(() => {
    const pending = tasks.map((t) => (t.id === taskId ? { ...t, dependencies: [...selected] } : t));
    return tasks
      .filter((t) => t.id !== taskId)
      .map((task) => ({
        task,
        checked: selected.includes(task.id),
        blocked: wouldCreateCycle(pending, taskId, task.id),
      }));
  }, [tasks, taskId, selected]);

  return (
    <fieldset>
      <legend className="mb-1 block font-semibold text-fg-muted">Depends on</legend>
      {options.length === 0 ? (
        <p className="text-fg-subtle">This project has no other task to depend on.</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
          {options.map(({ task, checked, blocked }) => (
            <li key={task.id}>
              <label
                className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
                  blocked && !checked ? 'opacity-40' : 'cursor-pointer hover:bg-elevated'
                }`}
                title={blocked && !checked ? 'Selecting this would create a dependency cycle.' : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={blocked && !checked}
                  onChange={() =>
                    onChange(checked ? selected.filter((id) => id !== task.id) : [...selected, task.id])
                  }
                  className="rounded border-line-strong bg-input text-purple-600"
                />
                <span className="flex-1 truncate text-fg">{task.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-fg-muted">
                  {task.startDate} → {task.dueDate}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
};
