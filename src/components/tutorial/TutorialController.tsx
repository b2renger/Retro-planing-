/**
 * The tutorial engine.
 *
 * Holds the current step, switches to the view it lives in, watches real state for the step's
 * completion predicate, advances on its own when the user does the thing, and lets them advance by
 * hand when detection is imperfect. Escape leaves, through the sandbox cleanup prompt.
 *
 * The current step lives in the store (persisted), so a reload resumes where the user stopped.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Coachmark } from './Coachmark';
import { ExitDialog } from './ExitDialog';
import { TutorialInvite } from './TutorialBanner';
import { useAnchor, scrollAnchorIntoView } from './useAnchor';
import { TUTORIAL_STEPS, snapshotProject, stepById, stepIndex, type TutorialFlags, type TutorialSnapshot } from './steps';

/** How long the "Done" state shows before the next step opens. */
const ADVANCE_DELAY_MS = 900;
/** Poll interval for the things that are only visible in the DOM (an open menu). */
const POLL_MS = 350;

function readExportMenuOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector('#header-export-btn')?.getAttribute('aria-expanded') === 'true';
}

function readModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

export const TutorialController: React.FC = () => {
  const {
    tutorial,
    projects,
    activeViewTab,
    setActiveViewTab,
    goToTutorialStep,
    completeTutorialStep,
    endTutorial,
    aiSettings,
    isSettingsOpen,
    isCloudPanelOpen,
  } = useApp();

  const running = tutorial.status === 'running' && tutorial.sandbox !== null;
  const step = stepById(tutorial.currentStepId);
  const index = stepIndex(tutorial.currentStepId);
  const [exitOpen, setExitOpen] = useState<null | 'early' | 'finished'>(null);
  const [tick, setTick] = useState(0);

  const sandboxProject = running ? projects.find((p) => p.id === tutorial.sandbox?.projectId) ?? null : null;

  // --- Baselines ------------------------------------------------------------------------------
  // A step is "done" when the live state differs from what it was when the step OPENED, so each
  // step records its own starting point first. It is state, not a ref, because nothing may be
  // judged complete before that snapshot exists — otherwise every step would fire on its first
  // render. Flags (panels) are armed only once they are closed, so a panel that was already open
  // does not tick the step off immediately.
  const [baseline, setBaseline] = useState<{ stepId: string; snapshot: TutorialSnapshot } | null>(null);
  const armed = useRef<TutorialFlags>({ settingsOpen: false, cloudPanelOpen: false, exportMenuOpen: false });
  const liveRef = useRef({ project: sandboxProject, providers: aiSettings.providers.length });
  liveRef.current = { project: sandboxProject, providers: aiSettings.providers.length };

  useEffect(() => {
    if (!running) {
      setBaseline(null);
      return;
    }
    setBaseline({ stepId: step.id, snapshot: snapshotProject(liveRef.current.project, liveRef.current.providers) });
    armed.current = {
      settingsOpen: !isSettingsOpen,
      cloudPanelOpen: !isCloudPanelOpen,
      exportMenuOpen: !readExportMenuOpen(),
    };
    // isSettingsOpen / isCloudPanelOpen are read once, on purpose: this is the starting state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, running]);

  // Follow the step's view and put its anchor on screen.
  useEffect(() => {
    if (!running) return;
    if (step.tab && step.tab !== activeViewTab) setActiveViewTab(step.tab);
  }, [running, step, activeViewTab, setActiveViewTab]);

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => scrollAnchorIntoView(step.anchor), 120);
    return () => window.clearTimeout(id);
  }, [running, step]);

  // Poll for the DOM-only signals; state changes re-render on their own.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1000), POLL_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const exportMenuOpen = running ? readExportMenuOpen() : false;
  const modalOpen = running ? readModalOpen() : false;
  void tick; // the interval above is what re-evaluates the two reads

  if (running) {
    const a = armed.current;
    if (!a.settingsOpen && !isSettingsOpen) a.settingsOpen = true;
    if (!a.cloudPanelOpen && !isCloudPanelOpen) a.cloudPanelOpen = true;
    if (!a.exportMenuOpen && !exportMenuOpen) a.exportMenuOpen = true;
  }

  const flags: TutorialFlags = {
    settingsOpen: armed.current.settingsOpen && isSettingsOpen,
    cloudPanelOpen: armed.current.cloudPanelOpen && isCloudPanelOpen,
    exportMenuOpen: armed.current.exportMenuOpen && exportMenuOpen,
  };

  const now = snapshotProject(sandboxProject, aiSettings.providers.length);
  const ready = baseline !== null && baseline.stepId === step.id;
  const done =
    running &&
    (tutorial.completedStepIds.includes(step.id) || (ready && step.isComplete({ before: baseline.snapshot, now, flags })));

  const { rect, viewport } = useAnchor(running ? step.anchor : null, running);

  // --- Navigation -----------------------------------------------------------------------------
  const goTo = useCallback(
    (nextIndex: number) => {
      const next = TUTORIAL_STEPS[nextIndex];
      if (next) goToTutorialStep(next.id);
    },
    [goToTutorialStep]
  );

  const advance = useCallback(() => {
    completeTutorialStep(step.id);
    if (index >= TUTORIAL_STEPS.length - 1) setExitOpen('finished');
    else goTo(index + 1);
  }, [completeTutorialStep, goTo, index, step.id]);

  // Auto-advance once the predicate says the user did it. Each step advances at most once, so
  // stepping back into a finished step leaves the user in control.
  const advancedFrom = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!running || !done || advancedFrom.current.has(step.id)) return;
    advancedFrom.current.add(step.id);
    completeTutorialStep(step.id);
    const id = window.setTimeout(() => {
      if (index >= TUTORIAL_STEPS.length - 1) setExitOpen('finished');
      else goTo(index + 1);
    }, ADVANCE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [running, done, completeTutorialStep, step.id, index, goTo]);

  // Escape always leaves (through the cleanup prompt), unless a dialog of the app owns it.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || readModalOpen()) return;
      e.preventDefault();
      setExitOpen('early');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);

  // The practice project was deleted from under us (backup restore, manual delete): stop cleanly.
  useEffect(() => {
    if (tutorial.status !== 'running') return;
    if (tutorial.sandbox && !projects.some((p) => p.id === tutorial.sandbox?.projectId)) {
      endTutorial({ removeSandbox: false, completed: false });
      setExitOpen(null);
    }
  }, [tutorial.status, tutorial.sandbox, projects, endTutorial]);

  if (!running) return <TutorialInvite />;

  return (
    <>
      <Coachmark
        stepNumber={index + 1}
        stepCount={TUTORIAL_STEPS.length}
        title={step.title}
        body={step.body}
        task={step.task}
        anchor={rect}
        viewport={viewport}
        preferred={step.placement}
        done={done}
        spotlight={!modalOpen}
        optional={step.optional}
        onNext={advance}
        onBack={() => goTo(index - 1)}
        onSkip={() => (index >= TUTORIAL_STEPS.length - 1 ? setExitOpen('finished') : goTo(index + 1))}
        onExit={() => setExitOpen('early')}
        isLast={index === TUTORIAL_STEPS.length - 1}
        canGoBack={index > 0}
      />

      <ExitDialog
        open={exitOpen !== null}
        finished={exitOpen === 'finished'}
        onCancel={() => setExitOpen(null)}
        onConfirm={({ removeSandbox }) => {
          endTutorial({ removeSandbox, completed: exitOpen === 'finished' });
          setExitOpen(null);
        }}
      />
    </>
  );
};
