import React, { useState } from 'react';
import { AlertTriangle, CalendarRange, Sparkles, X } from 'lucide-react';
import type { Project } from '../../types';
import { parseDay } from '../../services/export/common';

export interface WarningStripProps {
  warnings: readonly string[];
  onDismiss: () => void;
}

/** Surfaces `buildGanttModel` warnings (skipped rows, swapped dates) instead of dropping them. */
export const WarningStrip: React.FC<WarningStripProps> = ({ warnings, onDismiss }) => {
  if (warnings.length === 0) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold">
          {warnings.length} item{warnings.length > 1 ? 's' : ''} could not be drawn as stored
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss timeline warnings"
        className="shrink-0 rounded p-1 hover:bg-amber-500/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export interface TimelineEmptyStateProps {
  project: Project;
  onCreatePhase: (name: string, startDate: string, endDate: string) => void;
  onOpenCrunch: () => void;
}

/** Shown when the project has neither a phase nor a task: two real ways forward. */
export const TimelineEmptyState: React.FC<TimelineEmptyStateProps> = ({
  project,
  onCreatePhase,
  onOpenCrunch,
}) => {
  const defaultStart = parseDay(project.startDate) ? project.startDate : '';
  const defaultEnd = parseDay(project.targetDeliveryDate) ? project.targetDeliveryDate : '';
  const [name, setName] = useState('');
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const valid = name.trim().length > 0 && Boolean(parseDay(start)) && Boolean(parseDay(end));

  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center shadow-sm">
      <CalendarRange className="mx-auto h-9 w-9 text-fg-muted" />
      <h3 className="mt-3 text-sm font-bold text-fg">Nothing to schedule yet</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
        The timeline draws phases, tasks and milestones from the project. Create a first phase, or let
        the AI crunch turn your notes into a plan.
      </p>

      <form
        className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onCreatePhase(name.trim(), start, end);
          setName('');
        }}
      >
        <input
          type="text"
          aria-label="Phase name"
          placeholder="Phase name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[180px] flex-1 rounded-xl border border-line bg-input px-3 py-2 text-fg placeholder-fg-subtle focus:border-purple-500 focus:outline-none"
        />
        <input
          type="date"
          aria-label="Phase start date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-xl border border-line bg-input px-3 py-2 text-fg focus:border-purple-500 focus:outline-none"
        />
        <input
          type="date"
          aria-label="Phase end date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-xl border border-line bg-input px-3 py-2 text-fg focus:border-purple-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!valid}
          className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
        >
          Create phase
        </button>
      </form>

      <button
        type="button"
        onClick={onOpenCrunch}
        className="mx-auto mt-4 flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3.5 py-2 text-xs font-semibold text-fg transition-colors hover:bg-line"
      >
        <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        Open notes and run the AI crunch
      </button>
    </div>
  );
};
