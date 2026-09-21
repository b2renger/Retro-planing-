import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { appReducer, initialState, type AppState } from './appReducer';
import { DEFAULT_TUTORIAL, SANDBOX_TITLE, buildSandboxProject, reconcileTutorial } from './tutorial';

const userProject = (over: Partial<Project> = {}): Project => ({
  id: 'mine-1',
  workspaceId: 'ws-1',
  title: 'Real client work',
  clientName: 'A paying client',
  description: '',
  status: 'on-track',
  targetDeliveryDate: '2026-12-24',
  startDate: '2026-10-01',
  phases: [],
  tasks: [],
  milestones: [],
  documents: [],
  history: [],
  comments: [],
  clarificationQuestions: [],
  retroplanningScore: 100,
  tags: [],
  ...over,
});

function boot(projects: Project[]): AppState {
  return initialState({ projects, ui: { activeProjectId: projects[0]?.id ?? null, activeViewTab: 'markdown' } }, 'dark');
}

const at = '2026-09-21T12:00:00.000Z';

describe('buildSandboxProject', () => {
  it('is a fresh, clearly-labelled, history-free copy of the sample project', () => {
    const p = buildSandboxProject({ workspaceId: 'ws-1', at });
    expect(p.id).toMatch(/^tutorial-/);
    expect(p.id).not.toBe('proj-media-installation');
    expect(p.title).toBe(SANDBOX_TITLE);
    expect(p.isTutorialTemplate).toBe(true);
    expect(p.history).toEqual([]);
    expect(p.comments).toEqual([]);
    expect(p.cloud).toBeUndefined();
    expect(p.tasks.length).toBeGreaterThan(0);
    expect(p.tasks.every((t) => t.projectId === p.id)).toBe(true);
  });

  it('gives every run its own id, so two sandboxes never collide', () => {
    expect(buildSandboxProject({ workspaceId: 'ws-1', at }).id).not.toBe(buildSandboxProject({ workspaceId: 'ws-1', at }).id);
  });
});

describe('the sandbox round trip', () => {
  it('leaves the user projects byte-identical after start → work → finish', () => {
    const mine = [userProject(), userProject({ id: 'mine-2', title: 'Another one' })];
    const before = JSON.stringify(mine);
    let state = boot(mine);

    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    const sandboxId = state.tutorial.sandbox?.projectId as string;
    expect(state.projects).toHaveLength(3);
    expect(state.ui.activeProjectId).toBe(sandboxId);

    // The user does tutorial things — all of them land on the sandbox project only.
    state = appReducer(state, {
      type: 'projects',
      action: {
        type: 'project/setTargetDeliveryDate',
        projectId: sandboxId,
        actor: { id: 'user-1', name: 'B', avatar: '' },
        at,
        date: '2026-12-31',
        mode: 'shift-all',
      },
    });
    expect(state.projects.find((p) => p.id === sandboxId)?.targetDeliveryDate).toBe('2026-12-31');

    state = appReducer(state, { type: 'tutorial/complete', stepId: 'backward-planning' });
    state = appReducer(state, { type: 'tutorial/end', removeSandbox: true, completed: true, at });

    expect(state.projects).toHaveLength(2);
    expect(JSON.stringify(state.projects)).toBe(before);
    expect(state.tutorial.sandbox).toBeNull();
    expect(state.tutorial.status).toBe('idle');
    expect(state.tutorial.completedAt).toBe(at);
    expect(state.tutorial.completedStepIds).toEqual(['backward-planning']);
    // And the user is back where they were.
    expect(state.ui.activeProjectId).toBe('mine-1');
    expect(state.ui.activeViewTab).toBe('markdown');
  });

  it('creates no undo snapshot and no notification', () => {
    let state = boot([userProject()]);
    const notifications = state.notifications;
    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    state = appReducer(state, { type: 'tutorial/end', removeSandbox: true, completed: false, at });
    expect(state.undoStack).toEqual([]);
    expect(state.notifications).toBe(notifications);
  });

  it('keeps the practice project when the user opts in, and stays on it', () => {
    let state = boot([userProject()]);
    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    const sandboxId = state.tutorial.sandbox?.projectId as string;
    state = appReducer(state, { type: 'tutorial/end', removeSandbox: false, completed: true, at });
    expect(state.projects.map((p) => p.id)).toEqual(['mine-1', sandboxId]);
    expect(state.ui.activeProjectId).toBe(sandboxId);
  });

  it('resumes into the existing sandbox instead of piling up copies', () => {
    let state = boot([userProject()]);
    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    const first = state.tutorial.sandbox?.projectId;
    state = appReducer(state, { type: 'tutorial/goto', stepId: 'tasks' });
    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    expect(state.projects).toHaveLength(2);
    expect(state.tutorial.sandbox?.projectId).toBe(first);
    expect(state.tutorial.currentStepId).toBe('tasks');
  });

  it('starts from nothing at all: no project, and the user lands back on the empty state', () => {
    let state = boot([]);
    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    expect(state.projects).toHaveLength(1);
    state = appReducer(state, { type: 'tutorial/end', removeSandbox: true, completed: true, at });
    expect(state.projects).toEqual([]);
    expect(state.ui.activeProjectId).toBeNull();
  });
});

describe('progress actions', () => {
  it('records each step once, and reset clears progress without touching the sandbox', () => {
    let state = boot([userProject()]);
    state = appReducer(state, { type: 'tutorial/start', project: buildSandboxProject({ workspaceId: 'ws-1', at }), firstStepId: 'backward-planning', at });
    state = appReducer(state, { type: 'tutorial/complete', stepId: 'tasks' });
    const same = appReducer(state, { type: 'tutorial/complete', stepId: 'tasks' });
    expect(same).toBe(state);

    state = appReducer(state, { type: 'tutorial/reset' });
    expect(state.tutorial.completedStepIds).toEqual([]);
    expect(state.tutorial.currentStepId).toBeNull();
    expect(state.tutorial.sandbox).not.toBeNull();
  });

  it('remembers that the invitation was dismissed', () => {
    let state = boot([userProject()]);
    expect(state.tutorial.inviteDismissed).toBe(false);
    state = appReducer(state, { type: 'tutorial/dismissInvite' });
    expect(state.tutorial.inviteDismissed).toBe(true);
    expect(appReducer(state, { type: 'tutorial/dismissInvite' })).toBe(state);
  });
});

describe('reconcileTutorial', () => {
  it('falls back to the default for anything that is not a tutorial state', () => {
    expect(reconcileTutorial(null, [])).toEqual(DEFAULT_TUTORIAL);
    expect(reconcileTutorial('nonsense', [])).toEqual(DEFAULT_TUTORIAL);
    expect(reconcileTutorial({ completedStepIds: ['a', 2, null] }, []).completedStepIds).toEqual(['a']);
  });

  it('drops a sandbox whose project is gone and stops the tutorial with it', () => {
    const persisted = {
      status: 'running',
      currentStepId: 'tasks',
      completedStepIds: ['backward-planning'],
      completedAt: null,
      inviteDismissed: true,
      sandbox: { projectId: 'ghost', returnProjectId: 'mine-1', returnViewTab: 'tasks', startedAt: at },
    };
    const gone = reconcileTutorial(persisted, [userProject()]);
    expect(gone.sandbox).toBeNull();
    expect(gone.status).toBe('idle');
    // Progress survives the ghost.
    expect(gone.currentStepId).toBe('tasks');
    expect(gone.completedStepIds).toEqual(['backward-planning']);
    expect(gone.inviteDismissed).toBe(true);

    const alive = reconcileTutorial(persisted, [userProject(), userProject({ id: 'ghost' })]);
    expect(alive.status).toBe('running');
    expect(alive.sandbox?.returnViewTab).toBe('tasks');
  });

  it('repairs an unknown view tab', () => {
    const state = reconcileTutorial({ status: 'running', sandbox: { projectId: 'mine-1', returnViewTab: 'not-a-tab', startedAt: at } }, [userProject()]);
    expect(state.sandbox?.returnViewTab).toBe('retroplanning');
    expect(state.sandbox?.returnProjectId).toBeNull();
  });
});
