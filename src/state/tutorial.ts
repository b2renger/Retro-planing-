/**
 * Tutorial progress and its SANDBOX.
 *
 * The tutorial never writes into a project the user cares about. Starting it copies the bundled
 * sample project into a throwaway one (fresh id, `isTutorialTemplate: true`, no history, no cloud
 * link) and remembers where the user came from; ending it removes that copy again and puts the user
 * back. Everything here is pure so `src/state/tutorial.test.ts` can prove the round trip leaves the
 * user's own projects byte-identical.
 *
 * Step *content* lives in `src/components/tutorial/steps.ts`; this module only stores ids.
 */
import type { Project, ViewTab } from '../types';
import { MEDIA_INSTALLATION_PROJECT } from '../data/mockData';
import { newId } from './ids';
import { normalizeProject } from './projectsReducer';

/** Where the tutorial took the user from, and what it created to play with. */
export interface TutorialSandbox {
  /** The throwaway project created for the tutorial. */
  projectId: string;
  /** The project that was active when the tutorial started (`null` when there was none). */
  returnProjectId: string | null;
  /** The view that was active when the tutorial started. */
  returnViewTab: ViewTab;
  startedAt: string;
}

export interface TutorialState {
  status: 'idle' | 'running';
  /** The step the user is on; kept when they leave so a later start resumes. */
  currentStepId: string | null;
  completedStepIds: string[];
  /** ISO timestamp of the first full run-through; `null` until then (drives the first-run invite). */
  completedAt: string | null;
  /** The quiet first-run invitation was dismissed. */
  inviteDismissed: boolean;
  sandbox: TutorialSandbox | null;
}

export const DEFAULT_TUTORIAL: TutorialState = {
  status: 'idle',
  currentStepId: null,
  completedStepIds: [],
  completedAt: null,
  inviteDismissed: false,
  sandbox: null,
};

const VIEW_TABS: readonly ViewTab[] = ['immediate', 'retroplanning', 'hardware', 'tasks', 'markdown', 'collaboration', 'history'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

/**
 * Validates what came back from localStorage and drops a sandbox whose project no longer exists
 * (deleted by hand, or a backup restored over it), so the app never points at a ghost.
 */
export function reconcileTutorial(persisted: unknown, projects: readonly Project[]): TutorialState {
  if (!isRecord(persisted)) return DEFAULT_TUTORIAL;

  const rawSandbox = isRecord(persisted.sandbox) ? persisted.sandbox : null;
  const projectId = rawSandbox ? str(rawSandbox.projectId) : null;
  const alive = projectId !== null && projects.some((p) => p.id === projectId);
  const sandbox: TutorialSandbox | null =
    alive && rawSandbox
      ? {
          projectId: projectId as string,
          returnProjectId: str(rawSandbox.returnProjectId),
          returnViewTab: VIEW_TABS.includes(rawSandbox.returnViewTab as ViewTab) ? (rawSandbox.returnViewTab as ViewTab) : 'retroplanning',
          startedAt: str(rawSandbox.startedAt) ?? new Date().toISOString(),
        }
      : null;

  return {
    status: persisted.status === 'running' && sandbox ? 'running' : 'idle',
    currentStepId: str(persisted.currentStepId),
    completedStepIds: Array.isArray(persisted.completedStepIds) ? persisted.completedStepIds.filter((s): s is string => typeof s === 'string') : [],
    completedAt: str(persisted.completedAt),
    inviteDismissed: persisted.inviteDismissed === true,
    sandbox,
  };
}

/** Title prefix of every sandbox project, so it is recognisable in the project picker. */
export const SANDBOX_TITLE = 'Practice project (tutorial)';

/**
 * A disposable copy of the bundled sample project. It is built from the constant, never from the
 * user's own copy of it, so the tutorial is identical every time and edits made during the tutorial
 * can never reach anything the user owns.
 */
export function buildSandboxProject(defaults: { workspaceId: string; at: string }): Project {
  const clone = typeof structuredClone === 'function' ? structuredClone(MEDIA_INSTALLATION_PROJECT) : (JSON.parse(JSON.stringify(MEDIA_INSTALLATION_PROJECT)) as Project);
  return normalizeProject(
    {
      ...clone,
      id: newId('tutorial'),
      title: SANDBOX_TITLE,
      clientName: 'Nobody — this copy is yours to break',
      isTutorialTemplate: true,
      history: [],
      comments: [],
      cloud: undefined,
    },
    defaults
  );
}
