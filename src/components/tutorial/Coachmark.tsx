/**
 * The coachmark: a dimmed overlay with a hole around the target, plus a card that says what the
 * step is and what to do. The target stays fully interactive — the dim panels are
 * `pointer-events-none`, so nothing the tutorial draws can block the app underneath.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, GraduationCap, X } from 'lucide-react';
import { computePlacement, spotlightPanels, type Rect, type Size } from './placement';
import type { Placement } from './steps';

export interface CoachmarkProps {
  stepNumber: number;
  stepCount: number;
  title: string;
  body: string;
  task: string;
  /** Rect of the target, or `null` when it is not on screen (the card centres itself). */
  anchor: Rect | null;
  viewport: Size;
  preferred: Placement;
  /** Detected completion of the current step. */
  done: boolean;
  /** Dim everything but the target. Turned off while a dialog is open. */
  spotlight: boolean;
  optional?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onExit: () => void;
  isLast: boolean;
  canGoBack: boolean;
}

const CARD: Size = { width: 380, height: 260 };

export const Coachmark: React.FC<CoachmarkProps> = ({
  stepNumber,
  stepCount,
  title,
  body,
  task,
  anchor,
  viewport,
  preferred,
  done,
  spotlight,
  optional,
  onNext,
  onBack,
  onSkip,
  onExit,
  isLast,
  canGoBack,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<Size>(CARD);

  // Measure the card so the placement maths uses its real height, not a guess.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize((s) => (Math.abs(s.width - r.width) < 1 && Math.abs(s.height - r.height) < 1 ? s : { width: r.width, height: r.height }));
  }, [title, body, task, anchor, viewport, done]);

  // Focus the primary action when the step changes, so Tab/Enter work without a mouse — but never
  // steal focus from something the user is actually using (a field in the modal they just opened).
  useLayoutEffect(() => {
    const active = document.activeElement;
    const busyElsewhere = active !== null && active !== document.body && !cardRef.current?.contains(active);
    if (busyElsewhere) return;
    nextRef.current?.focus({ preventScroll: true });
  }, [stepNumber]);

  const pos = computePlacement({ anchor, card: size, viewport, preferred });
  const panels = spotlight ? spotlightPanels(anchor, viewport) : [];
  const ringPad = 6;

  return (
    <>
      {panels.map((p, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] bg-black/55"
          style={{ top: p.top, left: p.left, width: p.width, height: p.height }}
        />
      ))}

      {spotlight && anchor && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[61] rounded-xl ring-2 ring-purple-500 motion-safe:transition-all motion-safe:duration-200"
          style={{ top: anchor.top - ringPad, left: anchor.left - ringPad, width: anchor.width + ringPad * 2, height: anchor.height + ringPad * 2 }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-step-title"
        className="fixed z-[62] w-[min(380px,calc(100vw-24px))] rounded-2xl border border-purple-500/40 bg-card p-4 text-fg shadow-2xl motion-safe:transition-all motion-safe:duration-200"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              Step {stepNumber} of {stepCount}
            </span>
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label="Leave the tutorial"
            className="rounded-md p-1 text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div aria-live="polite" className="mt-2 space-y-2">
          <h2 id="tutorial-step-title" className="text-sm font-bold tracking-tight text-fg">
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-fg-muted">{body}</p>
          <p
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              done
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-purple-500/25 bg-purple-500/10 text-purple-800 dark:text-purple-200'
            }`}
          >
            {done ? <Check className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" /> : null}
            {done ? 'Done.' : task}
          </p>
          {pos.fallback && (
            <p className="text-[11px] text-fg-subtle">
              The control for this step is not on screen right now. Use “Next” to carry on, or go back to the view it lives in.
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onBack}
              disabled={!canGoBack}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              {optional ? 'Skip this step' : 'Skip'}
            </button>
          </div>

          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className="flex items-center gap-1 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            <span>{isLast ? 'Finish' : 'Next'}</span>
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full bg-purple-500 motion-safe:transition-all motion-safe:duration-300"
            style={{ width: `${Math.round((stepNumber / stepCount) * 100)}%` }}
          />
        </div>
      </div>
    </>
  );
};
