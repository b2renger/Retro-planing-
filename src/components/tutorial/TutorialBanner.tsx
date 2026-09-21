/**
 * The sandbox banner and the first-run invitation.
 *
 * The banner is in the page flow, directly under the navbar, for the whole time the tutorial runs:
 * it must be impossible to forget which project is being edited.
 */
import React from 'react';
import { GraduationCap, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FIRST_STEP_ID, TUTORIAL_STEPS } from './steps';

export const TutorialBanner: React.FC = () => {
  const { tutorial, projects } = useApp();
  if (tutorial.status !== 'running' || !tutorial.sandbox) return null;

  const returnTo = projects.find((p) => p.id === tutorial.sandbox?.returnProjectId);

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-purple-500/30 bg-purple-500/15 px-4 py-2 text-center text-[11px] font-medium text-purple-900 dark:text-purple-100"
    >
      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-purple-700 dark:text-purple-300" aria-hidden="true" />
      <span className="font-bold">Tutorial — practice project.</span>
      <span className="text-purple-900/80 dark:text-purple-100/80">
        Change anything you like here; your own projects are untouched{returnTo ? ` (you came from “${returnTo.title}”)` : ''}. This copy is removed when you finish.
      </span>
    </div>
  );
};

/** A quiet first-run invitation. Never a forced modal; dismissing it is one click and it stays dismissed. */
export const TutorialInvite: React.FC = () => {
  const { tutorial, startTutorial, dismissTutorialInvite } = useApp();
  if (tutorial.status === 'running' || tutorial.inviteDismissed || tutorial.completedAt) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[min(320px,calc(100vw-32px))] rounded-2xl border border-line bg-card p-3.5 shadow-xl">
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400">
          <GraduationCap className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold text-fg">First time here?</p>
          <p className="text-[11px] leading-relaxed text-fg-muted">
            {TUTORIAL_STEPS.length} short steps through backward planning, the timeline, notes, AI and export — on a practice copy, never on your own work.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissTutorialInvite}
          aria-label="Dismiss the tutorial invitation"
          className="rounded-md p-1 text-fg-muted transition-colors hover:bg-elevated hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={dismissTutorialInvite}
          className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => startTutorial(tutorial.currentStepId ?? FIRST_STEP_ID)}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-purple-500"
        >
          Start the tutorial
        </button>
      </div>
    </div>
  );
};
