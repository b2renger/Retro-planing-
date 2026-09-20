import React, { useEffect, useState } from 'react';
import { CalendarClock, Flag } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { parseDay } from '../../services/export/common';
import { daysBetween, formatDay } from './scale';

/** The two behaviours `updateTargetDeliveryDate` supports. */
export type TargetDateMode = 'anchor-only' | 'shift-all';

export interface TargetDateControlProps {
  targetDate: string;
  locale: string;
  /** Days between today and the target, or `null` when the stored date is unusable. */
  daysRemaining: number | null;
  onApply: (date: string, mode: TargetDateMode) => void;
}

const MODE_COPY: Record<TargetDateMode, { label: string; help: string }> = {
  'anchor-only': {
    label: 'Move the anchor only',
    help: 'Only the delivery date changes. Every phase, task and milestone keeps its dates.',
  },
  'shift-all': {
    label: 'Shift the whole plan',
    help: 'Every phase, task and milestone moves by the same number of days. Undoable.',
  },
};

/**
 * The delivery-date anchor. Changing it is never silent: the dialog asks which of the two
 * reducer modes to use and says what each one does before anything is written.
 */
export const TargetDateControl: React.FC<TargetDateControlProps> = ({
  targetDate,
  locale,
  daysRemaining,
  onApply,
}) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(targetDate);
  const [mode, setMode] = useState<TargetDateMode | null>(null);

  useEffect(() => {
    if (open) {
      setDate(targetDate);
      setMode(null);
    }
  }, [open, targetDate]);

  const valid = Boolean(parseDay(date));
  const delta = valid ? daysBetween(targetDate, date) : null;
  const changed = valid && date !== targetDate;

  const apply = (): void => {
    if (!changed || !mode) return;
    onApply(date, mode);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        id="retroplanning-target-date-input"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-xl border border-line bg-elevated px-3.5 py-2 text-left transition-colors hover:border-line-strong"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Flag className="h-4 w-4" />
        </span>
        <span className="block">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-fg-muted">
            Target delivery
          </span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 sm:text-sm">
              {parseDay(targetDate) ? formatDay(targetDate, locale, { dateStyle: 'medium' }) : 'Not set'}
            </span>
            {daysRemaining !== null && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                {daysRemaining >= 0 ? `${daysRemaining}d left` : `${Math.abs(daysRemaining)}d past`}
              </span>
            )}
          </span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change the delivery date"
        icon={<CalendarClock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
        subtitle="Pick what happens to the rest of the schedule."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-elevated px-3.5 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-line"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!changed || !mode}
              className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="target-date-field" className="mb-1 block font-semibold text-fg-muted">
              New delivery date
            </label>
            <input
              id="target-date-field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3 py-2 text-fg focus:border-purple-500 focus:outline-none"
            />
            {!valid && <p className="mt-1 text-rose-600 dark:text-rose-400">Pick a real calendar date.</p>}
          </div>

          <fieldset className="space-y-2" disabled={!changed}>
            <legend className="mb-1 font-semibold text-fg-muted">What should happen to the plan?</legend>
            {(Object.keys(MODE_COPY) as TargetDateMode[]).map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${
                  mode === option ? 'border-purple-500 bg-purple-500/10' : 'border-line bg-elevated'
                } ${changed ? '' : 'opacity-50'}`}
              >
                <input
                  type="radio"
                  name="target-date-mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold text-fg">{MODE_COPY[option].label}</span>
                  <span className="block text-fg-muted">{MODE_COPY[option].help}</span>
                  {option === 'shift-all' && delta !== null && delta !== 0 && (
                    <span className="mt-1 block font-mono text-[11px] text-purple-700 dark:text-purple-300">
                      {delta > 0 ? `+${delta}` : delta} days applied to every date
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>

          {!changed && <p className="text-fg-subtle">Pick a different date to choose a mode.</p>}
        </div>
      </Modal>
    </>
  );
};
