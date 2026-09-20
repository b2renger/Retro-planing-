/**
 * Root reducer: composes `projectsReducer` with the small non-project slices (team, notifications,
 * tutorial, settings, ui, undo). Pure; every side effect (storage, secrets) lives in AppContext.
 */
import type {
  AiProviderConfig,
  AiSettings,
  CloudAccount,
  CloudAccounts,
  CloudProviderId,
  CloudSettings,
  CloudStatus,
  Notification,
  Project,
  TeamInvitation,
  TutorialStep,
  User,
  Workspace,
} from '../types';
import { INITIAL_NOTIFICATIONS, INITIAL_PROJECTS, INITIAL_WORKSPACES, MOCK_USERS, TUTORIAL_STEPS } from '../data/mockData';
import type { PersistedState, UiState } from './persistence';
import { projectsReducer, type ProjectsAction } from './projectsReducer';
import { GOOGLE_CLIENT_SECRET_ID, aiSecretId } from './secrets';

export const NOTIFICATION_CAP = 100;
export const NOTIFICATION_DEDUPE_MS = 2000;
export const UNDO_CAP = 20;

export interface UndoSnapshot {
  label: string;
  projects: Project[];
  teamMembers: User[];
  workspaces: Workspace[];
  invitations: TeamInvitation[];
  activeProjectId: string | null;
  activeDocumentId: string | null;
}

export interface AppState {
  projects: Project[];
  workspaces: Workspace[];
  teamMembers: User[];
  invitations: TeamInvitation[];
  notifications: Notification[];
  aiSettings: AiSettings;
  cloudSettings: CloudSettings;
  cloudAccounts: CloudAccounts;
  cloudStatus: CloudStatus;
  tutorialSteps: TutorialStep[];
  ui: UiState;
  undoStack: UndoSnapshot[];
  secretsReady: boolean;
  storageError: string | null;
}

export const DEFAULT_AI_SETTINGS: AiSettings = { providers: [], defaultProviderId: null };
export const DEFAULT_CLOUD_SETTINGS: CloudSettings = { google: { clientId: '' }, onedrive: { clientId: '' } };

export const DEFAULT_UI: UiState = {
  activeProjectId: null,
  activeViewTab: 'retroplanning',
  activeDocumentId: null,
  currentUserId: null,
  activeWorkspaceId: null,
  theme: 'system',
};

/** Merge persisted tutorial completion flags onto the current step definitions (texts may change between versions). */
export function reconcileTutorial(persisted: TutorialStep[] | undefined): TutorialStep[] {
  const done = new Set((persisted ?? []).filter((s) => s && s.completed).map((s) => s.id));
  return TUTORIAL_STEPS.map((s) => ({ ...s, completed: done.has(s.id) }));
}

/** Builds the boot state from what `load()` returned; seeds the sample data only for slices that were never saved. */
export function initialState(persisted: PersistedState, theme: UiState['theme'], errors: string[] = []): AppState {
  const workspaces = persisted.workspaces && persisted.workspaces.length > 0 ? persisted.workspaces : INITIAL_WORKSPACES;
  const teamMembers = persisted.teamMembers && persisted.teamMembers.length > 0 ? persisted.teamMembers : MOCK_USERS;
  return {
    projects: persisted.projects ?? INITIAL_PROJECTS,
    workspaces,
    teamMembers,
    invitations: persisted.invitations ?? [],
    notifications: persisted.notifications ?? INITIAL_NOTIFICATIONS,
    aiSettings: persisted.aiSettings ? { ...DEFAULT_AI_SETTINGS, ...persisted.aiSettings, providers: persisted.aiSettings.providers ?? [] } : DEFAULT_AI_SETTINGS,
    cloudSettings: persisted.cloudSettings
      ? {
          google: { ...DEFAULT_CLOUD_SETTINGS.google, ...(persisted.cloudSettings.google ?? {}) },
          onedrive: { ...DEFAULT_CLOUD_SETTINGS.onedrive, ...(persisted.cloudSettings.onedrive ?? {}) },
        }
      : DEFAULT_CLOUD_SETTINGS,
    cloudAccounts: persisted.cloudAccounts ?? {},
    cloudStatus: { state: 'idle' },
    tutorialSteps: reconcileTutorial(persisted.tutorial),
    ui: { ...DEFAULT_UI, ...(persisted.ui ?? {}), theme },
    undoStack: [],
    secretsReady: false,
    storageError: errors.length ? errors.join(' ') : null,
  };
}

export type AppAction =
  | { type: 'projects'; action: ProjectsAction }
  | { type: 'ui/patch'; patch: Partial<UiState> }
  | { type: 'notifications/add'; notification: Notification }
  | { type: 'notifications/read'; id: string }
  | { type: 'notifications/readAll' }
  | { type: 'notifications/dismiss'; id: string }
  | { type: 'notifications/clear' }
  | { type: 'team/invite'; invitation: TeamInvitation }
  | { type: 'team/accept'; invitationId: string; member: User }
  | { type: 'team/revoke'; invitationId: string }
  | { type: 'team/remove'; userId: string; reassignTo: string }
  | { type: 'team/updateRole'; userId: string; role: string }
  | { type: 'tutorial/complete'; stepId: string }
  | { type: 'tutorial/reset' }
  | { type: 'ai/add'; provider: AiProviderConfig }
  | { type: 'ai/update'; id: string; patch: Partial<AiProviderConfig> }
  | { type: 'ai/remove'; id: string }
  | { type: 'ai/setDefault'; id: string | null }
  | { type: 'secrets/hydrate'; secrets: Record<string, string> }
  | { type: 'cloud/updateSettings'; patch: { google?: Partial<CloudSettings['google']>; onedrive?: Partial<CloudSettings['onedrive']> } }
  | { type: 'cloud/setAccount'; providerId: CloudProviderId; account: CloudAccount | null }
  | { type: 'cloud/setStatus'; status: CloudStatus }
  | { type: 'undo/push'; label: string }
  | { type: 'undo/pop' }
  | { type: 'store/restoreAll'; state: PersistedState }
  | { type: 'storage/error'; error: string | null };

function fixActiveProject(state: AppState): AppState {
  const { projects, ui } = state;
  const activeOk = ui.activeProjectId !== null && projects.some((p) => p.id === ui.activeProjectId);
  if (activeOk) return state;
  const next = projects[0]?.id ?? null;
  if (next === ui.activeProjectId) return state;
  return { ...state, ui: { ...ui, activeProjectId: next, activeDocumentId: null } };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'projects': {
      const projects = projectsReducer(state.projects, action.action);
      if (projects === state.projects) return state;
      return fixActiveProject({ ...state, projects });
    }

    case 'ui/patch': {
      const ui = { ...state.ui, ...action.patch };
      return fixActiveProject({ ...state, ui });
    }

    case 'notifications/add': {
      const n = action.notification;
      const t = Date.parse(n.timestamp);
      const dup = state.notifications.some(
        (x) => x.title === n.title && x.message === n.message && Math.abs(t - Date.parse(x.timestamp)) <= NOTIFICATION_DEDUPE_MS
      );
      if (dup) return state;
      return { ...state, notifications: [n, ...state.notifications].slice(0, NOTIFICATION_CAP) };
    }
    case 'notifications/read':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id && !n.read ? { ...n, read: true } : n)) };
    case 'notifications/readAll':
      return state.notifications.some((n) => !n.read) ? { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) } : state;
    case 'notifications/dismiss':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) };
    case 'notifications/clear':
      return state.notifications.length ? { ...state, notifications: [] } : state;

    case 'team/invite':
      return { ...state, invitations: [action.invitation, ...state.invitations] };
    case 'team/accept': {
      const inv = state.invitations.find((i) => i.id === action.invitationId);
      if (!inv || inv.status !== 'pending') return state;
      const member = action.member;
      const teamMembers = state.teamMembers.some((u) => u.id === member.id) ? state.teamMembers : [...state.teamMembers, member];
      const wsId = state.ui.activeWorkspaceId ?? state.workspaces[0]?.id;
      const workspaces = state.workspaces.map((ws) =>
        ws.id === wsId && !ws.members.some((m) => m.id === member.id) ? { ...ws, members: [...ws.members, member] } : ws
      );
      return {
        ...state,
        teamMembers,
        workspaces,
        invitations: state.invitations.map((i) => (i.id === inv.id ? { ...i, status: 'accepted' as const } : i)),
      };
    }
    case 'team/revoke':
      return { ...state, invitations: state.invitations.filter((i) => i.id !== action.invitationId) };
    case 'team/remove': {
      if (!state.teamMembers.some((u) => u.id === action.userId)) return state;
      if (state.teamMembers.length <= 1) return state; // never remove the last member
      const teamMembers = state.teamMembers.filter((u) => u.id !== action.userId);
      const reassignTo = teamMembers.some((u) => u.id === action.reassignTo) ? action.reassignTo : teamMembers[0].id;
      const projects = state.projects.map((p) =>
        p.tasks.some((t) => t.assigneeId === action.userId)
          ? { ...p, tasks: p.tasks.map((t) => (t.assigneeId === action.userId ? { ...t, assigneeId: reassignTo } : t)) }
          : p
      );
      const workspaces = state.workspaces.map((ws) =>
        ws.members.some((m) => m.id === action.userId) ? { ...ws, members: ws.members.filter((m) => m.id !== action.userId) } : ws
      );
      const ui = state.ui.currentUserId === action.userId ? { ...state.ui, currentUserId: reassignTo } : state.ui;
      return { ...state, teamMembers, projects, workspaces, ui };
    }
    case 'team/updateRole':
      return {
        ...state,
        teamMembers: state.teamMembers.map((u) => (u.id === action.userId ? { ...u, role: action.role } : u)),
        workspaces: state.workspaces.map((ws) => ({ ...ws, members: ws.members.map((m) => (m.id === action.userId ? { ...m, role: action.role } : m)) })),
      };

    case 'tutorial/complete':
      return state.tutorialSteps.some((s) => s.id === action.stepId && !s.completed)
        ? { ...state, tutorialSteps: state.tutorialSteps.map((s) => (s.id === action.stepId ? { ...s, completed: true } : s)) }
        : state;
    case 'tutorial/reset':
      return { ...state, tutorialSteps: TUTORIAL_STEPS.map((s) => ({ ...s, completed: false })) };

    case 'ai/add': {
      const providers = [...state.aiSettings.providers, action.provider];
      const defaultProviderId = state.aiSettings.defaultProviderId ?? action.provider.id;
      return { ...state, aiSettings: { providers, defaultProviderId } };
    }
    case 'ai/update':
      return {
        ...state,
        aiSettings: { ...state.aiSettings, providers: state.aiSettings.providers.map((p) => (p.id === action.id ? { ...p, ...action.patch, id: p.id } : p)) },
      };
    case 'ai/remove': {
      const providers = state.aiSettings.providers.filter((p) => p.id !== action.id);
      const defaultProviderId =
        state.aiSettings.defaultProviderId === action.id ? providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? null : state.aiSettings.defaultProviderId;
      return { ...state, aiSettings: { providers, defaultProviderId } };
    }
    case 'ai/setDefault':
      return { ...state, aiSettings: { ...state.aiSettings, defaultProviderId: action.id && state.aiSettings.providers.some((p) => p.id === action.id) ? action.id : null } };

    case 'secrets/hydrate': {
      const providers = state.aiSettings.providers.map((p) => {
        const key = action.secrets[aiSecretId(p.id)];
        return key && key !== p.apiKey ? { ...p, apiKey: key } : p;
      });
      const clientSecret = action.secrets[GOOGLE_CLIENT_SECRET_ID];
      const cloudSettings = clientSecret ? { ...state.cloudSettings, google: { ...state.cloudSettings.google, clientSecret } } : state.cloudSettings;
      return { ...state, aiSettings: { ...state.aiSettings, providers }, cloudSettings, secretsReady: true };
    }

    case 'cloud/updateSettings':
      return {
        ...state,
        cloudSettings: {
          google: { ...state.cloudSettings.google, ...(action.patch.google ?? {}) },
          onedrive: { ...state.cloudSettings.onedrive, ...(action.patch.onedrive ?? {}) },
        },
      };
    case 'cloud/setAccount': {
      const cloudAccounts = { ...state.cloudAccounts };
      if (action.account) cloudAccounts[action.providerId] = action.account;
      else delete cloudAccounts[action.providerId];
      return { ...state, cloudAccounts };
    }
    case 'cloud/setStatus':
      return { ...state, cloudStatus: action.status };

    case 'undo/push': {
      const snapshot: UndoSnapshot = {
        label: action.label,
        projects: state.projects,
        teamMembers: state.teamMembers,
        workspaces: state.workspaces,
        invitations: state.invitations,
        activeProjectId: state.ui.activeProjectId,
        activeDocumentId: state.ui.activeDocumentId,
      };
      return { ...state, undoStack: [...state.undoStack, snapshot].slice(-UNDO_CAP) };
    }
    case 'undo/pop': {
      const snapshot = state.undoStack[state.undoStack.length - 1];
      if (!snapshot) return state;
      return fixActiveProject({
        ...state,
        projects: snapshot.projects,
        teamMembers: snapshot.teamMembers,
        workspaces: snapshot.workspaces,
        invitations: snapshot.invitations,
        ui: { ...state.ui, activeProjectId: snapshot.activeProjectId, activeDocumentId: snapshot.activeDocumentId },
        undoStack: state.undoStack.slice(0, -1),
      });
    }

    case 'store/restoreAll': {
      const s = action.state;
      const restored = initialState(
        {
          projects: s.projects ?? state.projects,
          workspaces: s.workspaces ?? state.workspaces,
          teamMembers: s.teamMembers ?? state.teamMembers,
          invitations: s.invitations ?? state.invitations,
          notifications: s.notifications ?? state.notifications,
          aiSettings: s.aiSettings
            ? {
                ...s.aiSettings,
                // A backup never contains keys; keep the ones already loaded for providers with the same id.
                providers: s.aiSettings.providers.map((p) => ({ ...p, apiKey: p.apiKey ?? state.aiSettings.providers.find((x) => x.id === p.id)?.apiKey })),
              }
            : state.aiSettings,
          cloudSettings: s.cloudSettings ? { ...s.cloudSettings, google: { ...s.cloudSettings.google, clientSecret: s.cloudSettings.google.clientSecret ?? state.cloudSettings.google.clientSecret } } : state.cloudSettings,
          cloudAccounts: s.cloudAccounts ?? state.cloudAccounts,
          tutorial: s.tutorial ?? state.tutorialSteps,
          ui: { ...state.ui, ...(s.ui ?? {}) },
        },
        state.ui.theme
      );
      return fixActiveProject({ ...restored, cloudStatus: state.cloudStatus, undoStack: state.undoStack, secretsReady: state.secretsReady, storageError: state.storageError });
    }

    case 'storage/error':
      return state.storageError === action.error ? state : { ...state, storageError: action.error };

    default:
      return state;
  }
}
