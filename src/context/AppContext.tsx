/**
 * `useApp()` facade over the reducer-based store (src/state/*). See docs/dev/STATE-API.md.
 *
 * Rules kept here:
 * - every domain mutation is one reducer action (no stale-closure composition);
 * - persistence and secrets are side effects in this file only;
 * - the context value is memoised and every callback is stable (they read a ref for the
 *   current project / user), so consumers only re-render when state changes.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  AiProviderConfig,
  AiSettings,
  CloudAccount,
  CloudAccounts,
  CloudProviderId,
  CloudSettings,
  CloudStatus,
  CollaboratorPermissions,
  Comment,
  HistoryEntry,
  MarkdownDoc,
  Milestone,
  Notification,
  Phase,
  Project,
  ProjectCloudLink,
  Task,
  TaskStatus,
  TeamInvitation,
  Theme,
  User,
  ViewTab,
  Workspace,
} from '../types';
import { MOCK_USERS } from '../data/mockData';
import { initialsAvatar } from '../state/avatar';
import { newId } from '../state/ids';
import { appReducer, initialState, type AppState } from '../state/appReducer';
import { buildSandboxProject, type TutorialState } from '../state/tutorial';
import {
  exportAllJson,
  importAllJson,
  importProjectJson,
  load,
  save,
  stripSecrets,
  type PersistedState,
  type Slice,
} from '../state/persistence';
import { computeProjectHealth, normalizeProject, projectsActions, type AiStructuredInput, type HistoryInput, type TargetDateMode } from '../state/projectsReducer';
import { GOOGLE_CLIENT_SECRET_ID, aiSecretId, deleteSecret, hasSecureStore, loadSecrets, saveSecret, secretsBackend, type SecretsBackend } from '../state/secrets';
import { applyTheme, bootTheme, resolveTheme, watchSystemTheme, type ResolvedTheme } from '../state/themeBoot';

export type { ProjectHealth } from '../state/projectsReducer';
export { computeProjectHealth };

const MEMBER_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];

const FALLBACK_USER: User = MOCK_USERS[0];

export interface AppContextType {
  // People & workspaces
  currentUser: User;
  setCurrentUser: (id: string) => void;
  teamMembers: User[];
  invitations: TeamInvitation[];
  inviteCollaborator: (email: string, name: string, role: string, permissions: CollaboratorPermissions, note?: string) => TeamInvitation;
  acceptInvitation: (invitationId: string) => void;
  revokeInvitation: (invitationId: string) => void;
  removeTeamMember: (userId: string) => void;
  updateTeamMemberRole: (userId: string, role: string) => void;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspaceId: (id: string) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;

  // Projects
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  createProject: (project: Partial<Project>) => Project;
  updateProject: (patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Navigation
  activeViewTab: ViewTab;
  setActiveViewTab: (tab: ViewTab) => void;

  // Tasks
  addTask: (task: Omit<Task, 'id'>) => Task;
  updateTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;

  // Phases & milestones
  addPhase: (phase: Omit<Phase, 'id'>) => Phase;
  updatePhase: (phaseId: string, patch: Partial<Phase>) => void;
  deletePhase: (phaseId: string) => void;
  updatePhaseDates: (phaseId: string, startDate: string, endDate: string) => void;
  addMilestone: (milestone: Omit<Milestone, 'id'>) => Milestone;
  updateMilestone: (milestoneId: string, patch: Partial<Milestone>) => void;
  deleteMilestone: (milestoneId: string) => void;
  toggleMilestoneComplete: (milestoneId: string) => void;
  updateTargetDeliveryDate: (date: string, mode?: TargetDateMode) => void;

  // Documents
  activeDocument: MarkdownDoc | null;
  setActiveDocumentId: (id: string | null) => void;
  saveDocument: (doc: MarkdownDoc) => void;
  createDocument: (doc: Omit<MarkdownDoc, 'id' | 'lastModified' | 'lastModifiedBy'>) => MarkdownDoc;
  deleteDocument: (docId: string) => void;
  importDroppedFiles: (files: { name: string; content: string }[]) => MarkdownDoc[];
  applyAiStructuredData: (data: AiStructuredInput, options: { replace: boolean }) => void;

  // Comments, history, questions
  addComment: (content: string, targetType: Comment['targetType'], targetId: string) => void;
  addHistoryLog: (entry: HistoryInput) => void;
  resolveClarification: (questionId: string, response: string) => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // Tutorial — progress, current step and the sandbox project (see src/state/tutorial.ts)
  tutorial: TutorialState;
  /** Starts or resumes the tutorial: creates the sandbox project and switches to it. */
  startTutorial: (firstStepId: string) => void;
  goToTutorialStep: (stepId: string) => void;
  completeTutorialStep: (stepId: string) => void;
  /** Leaves the tutorial. `removeSandbox` deletes the practice project and returns to the previous one. */
  endTutorial: (options: { removeSandbox: boolean; completed: boolean }) => void;
  resetTutorial: () => void;
  dismissTutorialInvite: () => void;

  // Modal flags
  isCloudPanelOpen: boolean;
  setIsCloudPanelOpen: (open: boolean) => void;
  isAiAssistantOpen: boolean;
  setIsAiAssistantOpen: (open: boolean) => void;
  isCreateTaskModalOpen: boolean;
  setIsCreateTaskModalOpen: (open: boolean) => void;
  isCreateProjectModalOpen: boolean;
  setIsCreateProjectModalOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isInviteModalOpen: boolean;
  setIsInviteModalOpen: (open: boolean) => void;

  // Undo
  undo: () => void;
  canUndo: boolean;
  undoLabel: string | null;

  // Storage
  storageError: string | null;
  exportBackup: () => string;
  importBackup: (text: string) => { ok: boolean; error?: string };
  importProjectFromJson: (text: string) => { ok: boolean; error?: string; project?: Project };

  // AI settings
  aiSettings: AiSettings;
  activeAiProvider: AiProviderConfig | null;
  addAiProvider: (provider: Omit<AiProviderConfig, 'id'> & { id?: string }) => AiProviderConfig;
  updateAiProvider: (id: string, patch: Partial<AiProviderConfig>) => void;
  removeAiProvider: (id: string) => void;
  setDefaultAiProvider: (id: string | null) => void;
  secretsReady: boolean;
  secretsBackend: SecretsBackend;

  // Cloud
  cloudSettings: CloudSettings;
  updateCloudSettings: (patch: { google?: Partial<CloudSettings['google']>; onedrive?: Partial<CloudSettings['onedrive']> }) => void;
  cloudAccounts: CloudAccounts;
  setCloudAccount: (providerId: CloudProviderId, account: CloudAccount | null) => void;
  cloudStatus: CloudStatus;
  setCloudStatus: (status: CloudStatus) => void;
  setCloudLink: (projectId: string, link: ProjectCloudLink | null) => void;
  applyCloudPatch: (projectId: string, patch: { documents?: MarkdownDoc[]; projectPatch?: Partial<Project> }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function init(): AppState {
  const { state, errors } = load();
  return initialState(state, bootTheme, errors);
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, undefined, init);

  // Local, non-persisted UI flags.
  const [isCloudPanelOpen, setIsCloudPanelOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(state.ui.theme));

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const { projects, workspaces, teamMembers, invitations, notifications, aiSettings, cloudSettings, cloudAccounts, cloudStatus, tutorial, ui, undoStack, secretsReady, storageError } = state;

  const currentUser = useMemo(() => teamMembers.find((u) => u.id === ui.currentUserId) ?? teamMembers[0] ?? FALLBACK_USER, [teamMembers, ui.currentUserId]);
  const activeWorkspace = useMemo(() => workspaces.find((w) => w.id === ui.activeWorkspaceId) ?? workspaces[0], [workspaces, ui.activeWorkspaceId]);
  const activeProject = useMemo(() => projects.find((p) => p.id === ui.activeProjectId) ?? projects[0] ?? null, [projects, ui.activeProjectId]);
  const activeDocument = useMemo(
    () => activeProject?.documents.find((d) => d.id === ui.activeDocumentId) ?? activeProject?.documents[0] ?? null,
    [activeProject, ui.activeDocumentId]
  );
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const activeAiProvider = useMemo(
    () => aiSettings.providers.find((p) => p.id === aiSettings.defaultProviderId && p.enabled) ?? aiSettings.providers.find((p) => p.enabled) ?? null,
    [aiSettings]
  );

  // Callbacks read the live project/user through a ref so they stay referentially stable.
  const ctxRef = useRef({ projectId: activeProject?.id ?? '', actor: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, memberIds: teamMembers.map((u) => u.id), workspaceId: activeWorkspace?.id ?? 'ws-1' });
  ctxRef.current = {
    projectId: activeProject?.id ?? '',
    actor: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar },
    memberIds: teamMembers.map((u) => u.id),
    workspaceId: activeWorkspace?.id ?? 'ws-1',
  };
  const ctx = useCallback((projectId?: string) => ({ projectId: projectId ?? ctxRef.current.projectId, actor: ctxRef.current.actor }), []);
  const run = useCallback((action: ReturnType<(typeof projectsActions)[keyof typeof projectsActions]>) => dispatch({ type: 'projects', action }), []);
  const pushUndo = useCallback((label: string) => dispatch({ type: 'undo/push', label }), []);

  // ---------------------------------------------------------------------------
  // Persistence side effects
  // ---------------------------------------------------------------------------
  const persist = useCallback(<S extends Slice>(slice: S, value: PersistedState[S]) => {
    const res = save(slice, value);
    dispatch({ type: 'storage/error', error: res.ok ? null : res.error ?? 'Unknown storage error' });
  }, []);

  useEffect(() => persist('projects', projects), [projects, persist]);
  useEffect(() => persist('workspaces', workspaces), [workspaces, persist]);
  useEffect(() => persist('teamMembers', teamMembers), [teamMembers, persist]);
  useEffect(() => persist('invitations', invitations), [invitations, persist]);
  useEffect(() => persist('notifications', notifications), [notifications, persist]);
  useEffect(() => persist('tutorialState', tutorial), [tutorial, persist]);
  useEffect(() => persist('cloudAccounts', cloudAccounts), [cloudAccounts, persist]);
  useEffect(() => persist('ui', ui), [ui, persist]);
  useEffect(() => {
    // Secrets never reach localStorage when the OS secure store is available.
    const secure = hasSecureStore();
    persist('aiSettings', secure ? stripSecrets({ aiSettings }).aiSettings : aiSettings);
    persist('cloudSettings', secure ? stripSecrets({ cloudSettings }).cloudSettings : cloudSettings);
  }, [aiSettings, cloudSettings, persist]);

  useEffect(() => {
    let cancelled = false;
    loadSecrets()
      .then((secrets) => {
        if (!cancelled) dispatch({ type: 'secrets/hydrate', secrets });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'secrets/hydrate', secrets: {} });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Theme
  useEffect(() => {
    setResolvedTheme(applyTheme(ui.theme));
    if (ui.theme !== 'system') return;
    return watchSystemTheme(() => setResolvedTheme(applyTheme('system')));
  }, [ui.theme]);

  // ---------------------------------------------------------------------------
  // People & workspaces
  // ---------------------------------------------------------------------------
  const setCurrentUser = useCallback((id: string) => dispatch({ type: 'ui/patch', patch: { currentUserId: id } }), []);
  const setActiveWorkspaceId = useCallback((id: string) => dispatch({ type: 'ui/patch', patch: { activeWorkspaceId: id } }), []);
  const setTheme = useCallback((theme: Theme) => dispatch({ type: 'ui/patch', patch: { theme } }), []);

  const inviteCollaborator = useCallback((email: string, name: string, role: string, permissions: CollaboratorPermissions, note?: string): TeamInvitation => {
    const invitation: TeamInvitation = {
      id: newId('inv'),
      email: email.trim(),
      name: name.trim() || email.trim().split('@')[0],
      role: role || 'Collaborator',
      permissions,
      invitedAt: new Date().toISOString(),
      invitedBy: ctxRef.current.actor.name,
      status: 'pending',
      token: newId('tok'),
      note,
    };
    dispatch({ type: 'team/invite', invitation });
    return invitation;
  }, []);

  const acceptInvitation = useCallback((invitationId: string) => {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) return;
    const index = teamMembers.length;
    const color = MEMBER_COLORS[index % MEMBER_COLORS.length];
    const member: User = {
      id: newId('user'),
      name: inv.name,
      email: inv.email,
      avatar: initialsAvatar(inv.name, color),
      role: inv.role,
      color,
      status: 'active',
    };
    dispatch({ type: 'team/accept', invitationId, member });
  }, [invitations, teamMembers.length]);

  const revokeInvitation = useCallback((invitationId: string) => dispatch({ type: 'team/revoke', invitationId }), []);

  const removeTeamMember = useCallback((userId: string) => {
    const others = ctxRef.current.memberIds.filter((id) => id !== userId);
    if (others.length === 0) return;
    const reassignTo = ctxRef.current.actor.id !== userId ? ctxRef.current.actor.id : others[0];
    pushUndo('Remove team member');
    dispatch({ type: 'team/remove', userId, reassignTo });
  }, [pushUndo]);

  const updateTeamMemberRole = useCallback((userId: string, role: string) => dispatch({ type: 'team/updateRole', userId, role }), []);

  // ---------------------------------------------------------------------------
  // Projects & navigation
  // ---------------------------------------------------------------------------
  const setActiveProjectId = useCallback((id: string) => dispatch({ type: 'ui/patch', patch: { activeProjectId: id, activeDocumentId: null } }), []);
  const setActiveViewTab = useCallback((tab: ViewTab) => dispatch({ type: 'ui/patch', patch: { activeViewTab: tab } }), []);
  const setActiveDocumentId = useCallback((id: string | null) => dispatch({ type: 'ui/patch', patch: { activeDocumentId: id } }), []);

  const createProject = useCallback((input: Partial<Project>): Project => {
    const at = new Date().toISOString();
    const project = normalizeProject(input, { workspaceId: ctxRef.current.workspaceId, at });
    run(projectsActions.createProject({ ...ctx(project.id), at }, project));
    dispatch({ type: 'ui/patch', patch: { activeProjectId: project.id, activeDocumentId: project.documents[0]?.id ?? null } });
    return project;
  }, [ctx, run]);

  const updateProject = useCallback((patch: Partial<Project>) => run(projectsActions.updateProject(ctx(), patch)), [ctx, run]);

  const deleteProject = useCallback((id: string) => {
    pushUndo('Delete project');
    run(projectsActions.deleteProject(ctx(id)));
  }, [ctx, pushUndo, run]);

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------
  const addTask = useCallback((input: Omit<Task, 'id'>): Task => {
    const task: Task = { ...input, id: newId('task'), projectId: ctxRef.current.projectId };
    run(projectsActions.addTask(ctx(), task));
    return task;
  }, [ctx, run]);
  const updateTask = useCallback((task: Task) => run(projectsActions.updateTask(ctx(), task)), [ctx, run]);
  const deleteTask = useCallback((taskId: string) => {
    pushUndo('Delete task');
    run(projectsActions.deleteTask(ctx(), taskId));
  }, [ctx, pushUndo, run]);
  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => run(projectsActions.setTaskStatus(ctx(), taskId, status)), [ctx, run]);
  const toggleChecklistItem = useCallback((taskId: string, itemId: string) => run(projectsActions.toggleChecklistItem(ctx(), taskId, itemId)), [ctx, run]);

  // ---------------------------------------------------------------------------
  // Phases & milestones
  // ---------------------------------------------------------------------------
  const addPhase = useCallback((input: Omit<Phase, 'id'>): Phase => {
    const phase: Phase = { ...input, id: newId('phase') };
    run(projectsActions.addPhase(ctx(), phase));
    return phase;
  }, [ctx, run]);
  const updatePhase = useCallback((phaseId: string, patch: Partial<Phase>) => run(projectsActions.updatePhase(ctx(), phaseId, patch)), [ctx, run]);
  const deletePhase = useCallback((phaseId: string) => {
    pushUndo('Delete phase');
    run(projectsActions.deletePhase(ctx(), phaseId));
  }, [ctx, pushUndo, run]);
  const updatePhaseDates = useCallback((phaseId: string, startDate: string, endDate: string) => run(projectsActions.updatePhase(ctx(), phaseId, { startDate, endDate })), [ctx, run]);

  const addMilestone = useCallback((input: Omit<Milestone, 'id'>): Milestone => {
    const milestone: Milestone = { ...input, id: newId('ms') };
    run(projectsActions.addMilestone(ctx(), milestone));
    return milestone;
  }, [ctx, run]);
  const updateMilestone = useCallback((milestoneId: string, patch: Partial<Milestone>) => run(projectsActions.updateMilestone(ctx(), milestoneId, patch)), [ctx, run]);
  const deleteMilestone = useCallback((milestoneId: string) => {
    pushUndo('Delete milestone');
    run(projectsActions.deleteMilestone(ctx(), milestoneId));
  }, [ctx, pushUndo, run]);
  const toggleMilestoneComplete = useCallback((milestoneId: string) => run(projectsActions.toggleMilestone(ctx(), milestoneId)), [ctx, run]);

  const updateTargetDeliveryDate = useCallback((date: string, mode: TargetDateMode = 'anchor-only') => {
    if (mode === 'shift-all') pushUndo('Shift all dates');
    run(projectsActions.setTargetDeliveryDate(ctx(), date, mode));
  }, [ctx, pushUndo, run]);

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------
  const saveDocument = useCallback((doc: MarkdownDoc) => run(projectsActions.saveDocument(ctx(), doc)), [ctx, run]);

  const createDocument = useCallback((input: Omit<MarkdownDoc, 'id' | 'lastModified' | 'lastModifiedBy'>): MarkdownDoc => {
    const doc: MarkdownDoc = { ...input, id: newId('doc'), lastModified: new Date().toISOString(), lastModifiedBy: ctxRef.current.actor.name };
    run(projectsActions.createDocument(ctx(), doc));
    dispatch({ type: 'ui/patch', patch: { activeDocumentId: doc.id } });
    return doc;
  }, [ctx, run]);

  const deleteDocument = useCallback((docId: string) => {
    pushUndo('Delete document');
    run(projectsActions.deleteDocument(ctx(), docId));
    dispatch({ type: 'ui/patch', patch: { activeDocumentId: null } });
  }, [ctx, pushUndo, run]);

  const importDroppedFiles = useCallback((files: { name: string; content: string }[]): MarkdownDoc[] => {
    const at = new Date().toISOString();
    const docs: MarkdownDoc[] = files.map((f) => ({
      id: newId('doc'),
      title: f.name,
      path: `imports/${f.name}`,
      content: f.content,
      tags: ['Imported'],
      lastModified: at,
      lastModifiedBy: ctxRef.current.actor.name,
    }));
    if (docs.length === 0) return docs;
    run(projectsActions.importDocuments({ ...ctx(), at }, docs));
    dispatch({ type: 'ui/patch', patch: { activeDocumentId: docs[0].id } });
    return docs;
  }, [ctx, run]);

  const applyAiStructuredData = useCallback((data: AiStructuredInput, options: { replace: boolean }) => {
    pushUndo(options.replace ? 'Apply AI plan (replace)' : 'Merge AI plan');
    run(projectsActions.applyAiStructure(ctx(), data, { replace: options.replace, knownAssigneeIds: ctxRef.current.memberIds }));
  }, [ctx, pushUndo, run]);

  // ---------------------------------------------------------------------------
  // Comments, history, questions
  // ---------------------------------------------------------------------------
  const addComment = useCallback((content: string, targetType: Comment['targetType'], targetId: string) => {
    const actor = ctxRef.current.actor;
    const comment: Comment = {
      id: newId('comm'),
      authorId: actor.id,
      authorName: actor.name,
      authorAvatar: actor.avatar,
      timestamp: new Date().toISOString(),
      content,
      targetType,
      targetId,
    };
    run(projectsActions.addComment(ctx(), comment));
  }, [ctx, run]);
  const addHistoryLog = useCallback((entry: HistoryInput) => run(projectsActions.addHistory(ctx(), entry)), [ctx, run]);
  const resolveClarification = useCallback((questionId: string, response: string) => run(projectsActions.resolveClarification(ctx(), questionId, response)), [ctx, run]);

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  const addNotification = useCallback((input: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    dispatch({ type: 'notifications/add', notification: { ...input, id: newId('notif'), timestamp: new Date().toISOString(), read: false } });
  }, []);
  const markNotificationRead = useCallback((id: string) => dispatch({ type: 'notifications/read', id }), []);
  const markAllNotificationsRead = useCallback(() => dispatch({ type: 'notifications/readAll' }), []);
  const dismissNotification = useCallback((id: string) => dispatch({ type: 'notifications/dismiss', id }), []);
  const clearNotifications = useCallback(() => dispatch({ type: 'notifications/clear' }), []);

  // ---------------------------------------------------------------------------
  // Tutorial
  // ---------------------------------------------------------------------------
  const completeTutorialStep = useCallback((stepId: string) => dispatch({ type: 'tutorial/complete', stepId }), []);
  const goToTutorialStep = useCallback((stepId: string) => dispatch({ type: 'tutorial/goto', stepId }), []);
  /**
   * The sandbox is built here and handed to the reducer, which appends it directly — not through
   * `createProject` — so starting the tutorial pushes no undo snapshot and writes no notification.
   * The reducer ignores the new copy when a live sandbox already exists (that is a resume).
   */
  const startTutorial = useCallback((firstStepId: string) => {
    const at = new Date().toISOString();
    const project = buildSandboxProject({ workspaceId: ctxRef.current.workspaceId, at });
    dispatch({ type: 'tutorial/start', project, firstStepId, at });
  }, []);
  const endTutorial = useCallback(
    (options: { removeSandbox: boolean; completed: boolean }) =>
      dispatch({ type: 'tutorial/end', removeSandbox: options.removeSandbox, completed: options.completed, at: new Date().toISOString() }),
    []
  );
  const resetTutorial = useCallback(() => dispatch({ type: 'tutorial/reset' }), []);
  const dismissTutorialInvite = useCallback(() => dispatch({ type: 'tutorial/dismissInvite' }), []);

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------
  const undo = useCallback(() => dispatch({ type: 'undo/pop' }), []);
  const canUndo = undoStack.length > 0;
  const undoLabel = undoStack.length ? undoStack[undoStack.length - 1].label : null;

  // ---------------------------------------------------------------------------
  // Backup / restore
  // ---------------------------------------------------------------------------
  const stateRef = useRef(state);
  stateRef.current = state;

  const exportBackup = useCallback((): string => {
    const s = stateRef.current;
    return exportAllJson({
      projects: s.projects,
      workspaces: s.workspaces,
      teamMembers: s.teamMembers,
      invitations: s.invitations,
      notifications: s.notifications,
      aiSettings: s.aiSettings,
      cloudSettings: s.cloudSettings,
      cloudAccounts: s.cloudAccounts,
      tutorialState: s.tutorial,
      ui: s.ui,
    });
  }, []);

  const importBackup = useCallback((text: string): { ok: boolean; error?: string } => {
    try {
      const parsed = importAllJson(text);
      pushUndo('Restore backup');
      dispatch({ type: 'store/restoreAll', state: parsed });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [pushUndo]);

  const importProjectFromJson = useCallback((text: string): { ok: boolean; error?: string; project?: Project } => {
    try {
      const project = importProjectJson(text);
      const exists = stateRef.current.projects.some((p) => p.id === project.id);
      pushUndo(exists ? 'Replace project from JSON' : 'Import project from JSON');
      run(projectsActions.restoreProject(ctx(project.id), project));
      dispatch({ type: 'ui/patch', patch: { activeProjectId: project.id, activeDocumentId: null } });
      return { ok: true, project };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [ctx, pushUndo, run]);

  // ---------------------------------------------------------------------------
  // AI settings (+ secrets)
  // ---------------------------------------------------------------------------
  const storeSecret = useCallback((id: string, value: string | undefined) => {
    if (!hasSecureStore()) return; // web build: the value stays inside the persisted settings (clear text)
    const op = value ? saveSecret(id, value) : deleteSecret(id);
    op.catch((err) => console.warn(`[secrets] ${id}: ${err instanceof Error ? err.message : String(err)}`));
  }, []);

  const addAiProvider = useCallback((input: Omit<AiProviderConfig, 'id'> & { id?: string }): AiProviderConfig => {
    const provider: AiProviderConfig = { ...input, id: input.id ?? newId('ai') };
    dispatch({ type: 'ai/add', provider });
    if (provider.apiKey) storeSecret(aiSecretId(provider.id), provider.apiKey);
    return provider;
  }, [storeSecret]);

  const updateAiProvider = useCallback((id: string, patch: Partial<AiProviderConfig>) => {
    dispatch({ type: 'ai/update', id, patch });
    if ('apiKey' in patch) storeSecret(aiSecretId(id), patch.apiKey);
  }, [storeSecret]);

  const removeAiProvider = useCallback((id: string) => {
    dispatch({ type: 'ai/remove', id });
    storeSecret(aiSecretId(id), undefined);
  }, [storeSecret]);

  const setDefaultAiProvider = useCallback((id: string | null) => dispatch({ type: 'ai/setDefault', id }), []);

  // ---------------------------------------------------------------------------
  // Cloud
  // ---------------------------------------------------------------------------
  const updateCloudSettings = useCallback((patch: { google?: Partial<CloudSettings['google']>; onedrive?: Partial<CloudSettings['onedrive']> }) => {
    dispatch({ type: 'cloud/updateSettings', patch });
    if (patch.google && 'clientSecret' in patch.google) storeSecret(GOOGLE_CLIENT_SECRET_ID, patch.google.clientSecret);
  }, [storeSecret]);
  const setCloudAccount = useCallback((providerId: CloudProviderId, account: CloudAccount | null) => dispatch({ type: 'cloud/setAccount', providerId, account }), []);
  const setCloudStatus = useCallback((status: CloudStatus) => dispatch({ type: 'cloud/setStatus', status }), []);
  const setCloudLink = useCallback((projectId: string, link: ProjectCloudLink | null) => run(projectsActions.setCloudLink(ctx(projectId), link)), [ctx, run]);
  const applyCloudPatch = useCallback(
    (projectId: string, patch: { documents?: MarkdownDoc[]; projectPatch?: Partial<Project> }) => run(projectsActions.applyCloudPatch(ctx(projectId), patch)),
    [ctx, run]
  );

  // ---------------------------------------------------------------------------
  // Value
  // ---------------------------------------------------------------------------
  const value = useMemo<AppContextType>(
    () => ({
      currentUser,
      setCurrentUser,
      teamMembers,
      invitations,
      inviteCollaborator,
      acceptInvitation,
      revokeInvitation,
      removeTeamMember,
      updateTeamMemberRole,
      workspaces,
      activeWorkspace,
      setActiveWorkspaceId,
      theme: ui.theme,
      setTheme,
      resolvedTheme,
      projects,
      activeProject,
      setActiveProjectId,
      createProject,
      updateProject,
      deleteProject,
      activeViewTab: ui.activeViewTab,
      setActiveViewTab,
      addTask,
      updateTask,
      deleteTask,
      updateTaskStatus,
      toggleChecklistItem,
      editingTaskId,
      setEditingTaskId,
      addPhase,
      updatePhase,
      deletePhase,
      updatePhaseDates,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      toggleMilestoneComplete,
      updateTargetDeliveryDate,
      activeDocument,
      setActiveDocumentId,
      saveDocument,
      createDocument,
      deleteDocument,
      importDroppedFiles,
      applyAiStructuredData,
      addComment,
      addHistoryLog,
      resolveClarification,
      notifications,
      unreadCount,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      dismissNotification,
      clearNotifications,
      tutorial,
      startTutorial,
      goToTutorialStep,
      completeTutorialStep,
      endTutorial,
      resetTutorial,
      dismissTutorialInvite,
      isCloudPanelOpen,
      setIsCloudPanelOpen,
      isAiAssistantOpen,
      setIsAiAssistantOpen,
      isCreateTaskModalOpen,
      setIsCreateTaskModalOpen,
      isCreateProjectModalOpen,
      setIsCreateProjectModalOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      isInviteModalOpen,
      setIsInviteModalOpen,
      undo,
      canUndo,
      undoLabel,
      storageError,
      exportBackup,
      importBackup,
      importProjectFromJson,
      aiSettings,
      activeAiProvider,
      addAiProvider,
      updateAiProvider,
      removeAiProvider,
      setDefaultAiProvider,
      secretsReady,
      secretsBackend: secretsBackend(),
      cloudSettings,
      updateCloudSettings,
      cloudAccounts,
      setCloudAccount,
      cloudStatus,
      setCloudStatus,
      setCloudLink,
      applyCloudPatch,
    }),
    [
      currentUser, setCurrentUser, teamMembers, invitations, inviteCollaborator, acceptInvitation, revokeInvitation, removeTeamMember, updateTeamMemberRole,
      workspaces, activeWorkspace, setActiveWorkspaceId, ui.theme, setTheme, resolvedTheme, projects, activeProject, setActiveProjectId, createProject,
      updateProject, deleteProject, ui.activeViewTab, setActiveViewTab, addTask, updateTask, deleteTask, updateTaskStatus, toggleChecklistItem,
      editingTaskId, addPhase, updatePhase, deletePhase, updatePhaseDates, addMilestone, updateMilestone, deleteMilestone, toggleMilestoneComplete,
      updateTargetDeliveryDate, activeDocument, setActiveDocumentId, saveDocument, createDocument, deleteDocument, importDroppedFiles,
      applyAiStructuredData, addComment, addHistoryLog, resolveClarification, notifications, unreadCount, addNotification, markNotificationRead,
      markAllNotificationsRead, dismissNotification, clearNotifications, tutorial, startTutorial, goToTutorialStep, completeTutorialStep,
      endTutorial, resetTutorial, dismissTutorialInvite, isCloudPanelOpen, isAiAssistantOpen, isCreateTaskModalOpen, isCreateProjectModalOpen, isSettingsOpen, isInviteModalOpen,
      undo, canUndo, undoLabel, storageError, exportBackup, importBackup, importProjectFromJson, aiSettings, activeAiProvider, addAiProvider,
      updateAiProvider, removeAiProvider, setDefaultAiProvider, secretsReady, cloudSettings, updateCloudSettings, cloudAccounts, setCloudAccount,
      cloudStatus, setCloudStatus, setCloudLink, applyCloudPatch,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

/**
 * The active project for views that App only renders when one exists. Throws otherwise so a view
 * is never silently drawn against `null` (App shows the empty state instead).
 */
export const useActiveProject = (): Project => {
  const { activeProject } = useApp();
  if (!activeProject) throw new Error('useActiveProject: no active project; render this view only when useApp().activeProject is set');
  return activeProject;
};

export type { HistoryEntry };
