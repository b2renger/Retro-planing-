import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface ChipEditorProps {
  id: string;
  title: string;
  placeholder: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
}

/** Add/remove list editor used for deliverables and tags. Duplicates are ignored. */
export const ChipEditor: React.FC<ChipEditorProps> = ({ id, title, placeholder, values, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = (): void => {
    const value = draft.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft('');
  };

  return (
    <div>
      <label className="mb-1 block font-semibold text-fg-muted" htmlFor={id}>
        {title}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          placeholder={placeholder}
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
          aria-label={`Add to ${title.toLowerCase()}`}
          className="shrink-0 rounded-xl border border-line bg-elevated px-3 text-fg-muted transition-colors hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="flex items-center gap-1 rounded-full border border-line bg-elevated px-2 py-0.5 text-[11px] text-fg"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Remove ${value}`}
                className="text-fg-subtle hover:text-rose-600 dark:hover:text-rose-400"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
