import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import type { TaskChecklistItem } from '../../types';
import { newId } from '../../state/ids';
import { moveChecklistItem } from './draft';

export interface ChecklistEditorProps {
  items: readonly TaskChecklistItem[];
  onChange: (items: TaskChecklistItem[]) => void;
}

/** Checklist with add, remove, reorder and toggle. */
export const ChecklistEditor: React.FC<ChecklistEditorProps> = ({ items, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = (): void => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId('check'), text, completed: false }]);
    setDraft('');
  };

  return (
    <fieldset>
      <legend className="mb-1 block font-semibold text-fg-muted">Checklist</legend>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2 rounded-lg bg-elevated px-2 py-1.5">
            <input
              type="checkbox"
              checked={item.completed}
              aria-label={`Mark "${item.text}" done`}
              onChange={() =>
                onChange(items.map((c) => (c.id === item.id ? { ...c, completed: !c.completed } : c)))
              }
              className="rounded border-line-strong bg-input text-purple-600"
            />
            <span className={`flex-1 truncate ${item.completed ? 'text-fg-subtle line-through' : 'text-fg'}`}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => onChange(moveChecklistItem(items, index, -1))}
              disabled={index === 0}
              aria-label={`Move "${item.text}" up`}
              className="text-fg-subtle hover:text-fg disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange(moveChecklistItem(items, index, 1))}
              disabled={index === items.length - 1}
              aria-label={`Move "${item.text}" down`}
              className="text-fg-subtle hover:text-fg disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange(items.filter((c) => c.id !== item.id))}
              aria-label={`Remove "${item.text}"`}
              className="text-fg-subtle hover:text-rose-600 dark:hover:text-rose-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          aria-label="New checklist item"
          placeholder="Add a checklist item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add();
          }}
          className="w-full rounded-xl border border-line bg-input px-3 py-2 text-fg placeholder-fg-subtle focus:border-purple-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add checklist item"
          className="shrink-0 rounded-xl border border-line bg-elevated px-3 text-fg-muted transition-colors hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </fieldset>
  );
};
