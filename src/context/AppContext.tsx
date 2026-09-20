import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  Workspace,
  Project,
  Task,
  Phase,
  Milestone,
  MarkdownDoc,
  HistoryEntry,
  Notification,
  ClarificationQuestion,
  ViewTab,
  Comment,
  TaskStatus,
  GoogleAccount,
  ApiSettings,
  TutorialStep,
  TeamInvitation,
  CollaboratorPermissions,
} from '../types';
import {
  MOCK_USERS,
  INITIAL_WORKSPACES,
  INITIAL_PROJECTS,
  INITIAL_NOTIFICATIONS,
  DEFAULT_GOOGLE_ACCOUNT,
  DEFAULT_API_SETTINGS,
  TUTORIAL_STEPS,
  TUTORIAL_PROJECT,
} from '../data/mockData';
import { validateGeminiApiKey } from '../services/geminiService';
import { RobustStorageService } from '../services/storageService';

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspaceId: (id: string) => void;
  projects: Project[];
  activeProject: Project;
  setActiveProjectId: (id: string) => void;
  activeViewTab: ViewTab;
  setActiveViewTab: (tab: ViewTab) => void;
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;

  // Google & API Key Settings
  googleAccount: GoogleAccount;
  loginWithGoogle: (email?: string, name?: string) => void;
  logoutGoogle: () => void;
  apiSettings: ApiSettings;
  updateApiSettings: (settings: Partial<ApiSettings>) => void;
  testCurrentApiKey: () => Promise<{ valid: boolean; message?: string }>;
  isApiSettingsOpen: boolean;
  setIsApiSettingsOpen: (open: boolean) => void;
  isGoogleLoginOpen: boolean;
  setIsGoogleLoginOpen: (open: boolean) => void;

  // Database Testing & Durability
  isDatabaseTesterOpen: boolean;
  setIsDatabaseTesterOpen: (open: boolean) => void;

  // Tutorial System & Interactive Demo
  tutorialSteps: TutorialStep[];
  isTutorialActive: boolean;
  isTutorialDrawerOpen: boolean;
  setIsTutorialDrawerOpen: (open: boolean) => void;
  isInteractiveDemoOpen: boolean;
  setIsInteractiveDemoOpen: (open: boolean) => void;
  isDemoPlaying: boolean;
  startTutorial: () => void;
  completeTutorialStep: (stepId: string) => void;
  resetTutorial: () => void;
  runLiveFeatureDemonstration: (stepId: string) => Promise<void>;

  // Team Invitation & Collaborator Management
  teamMembers: User[];
  invitations: TeamInvitation[];
  inviteCollaborator: (email: string, name: string, role: string, permissions: CollaboratorPermissions, note?: string) => void;
  removeTeamMember: (userId: string) => void;
  updateTeamMemberRole: (userId: string, newRole: string) => void;
  revokeInvitation: (invitationId: string) => void;
  isInviteModalOpen: boolean;
  setIsInviteModalOpen: (open: boolean) => void;

  // Implementation Plan & Verification Matrix
  isImplementationPlanOpen: boolean;
  setIsImplementationPlanOpen: (open: boolean) => void;

  // Project Actions
  createProject: (newProj: Partial<Project>) => void;
  updateProject: (updatedProj: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Task Actions
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  toggleChecklistItem: (taskId: string, checklistItemId: string) => void;

  // Phase & Milestone Actions
  updatePhaseDates: (phaseId: string, startDate: string, endDate: string) => void;
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  toggleMilestoneComplete: (milestoneId: string) => void;
  updateTargetDeliveryDate: (date: string) => void;

  // Document & Markdown Actions
  activeDocument: MarkdownDoc | null;
  setActiveDocumentId: (id: string | null) => void;
  saveDocument: (doc: MarkdownDoc) => void;
  createDocument: (doc: Omit<MarkdownDoc, 'id' | 'lastModified' | 'lastModifiedBy'>) => MarkdownDoc;
  deleteDocument: (id: string) => void;
  importDroppedFiles: (files: { name: string; content: string }[]) => void;
  applyAiStructuredData: (structuredData: any) => void;

  // Comments & History
  addComment: (content: string, targetType: 'task' | 'milestone' | 'document' | 'project', targetId: string) => void;
  addHistoryLog: (entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'userId' | 'userName' | 'userAvatar'>) => void;
  revertHistoryState: (entry: HistoryEntry) => void;

  // Clarifications
  resolveClarification: (id: string, response: string) => void;

  // Modals & Export
  isDriveModalOpen: boolean;
  setIsDriveModalOpen: (open: boolean) => void;
  isAiAssistantOpen: boolean;
  setIsAiAssistantOpen: (open: boolean) => void;
  isCreateTaskModalOpen: boolean;
  setIsCreateTaskModalOpen: (open: boolean) => void;
  isCreateProjectModalOpen: boolean;
  setIsCreateProjectModalOpen: (open: boolean) => void;
  exportProjectAsMarkdown: () => string;
  exportProjectAsJson: () => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PROJECTS = 'retroplan_projects_v4_media';
const STORAGE_KEY_WORKSPACES = 'retroplan_workspaces_v4_media';
const STORAGE_KEY_NOTIFS = 'retroplan_notifs_v4_media';
const STORAGE_KEY_GOOGLE = 'retroplan_google_auth_v4_media';
const STORAGE_KEY_API_SETTINGS = 'retroplan_api_settings_v4_media';
const STORAGE_KEY_TUTORIAL = 'retroplan_tutorial_steps_v4_media';
const STORAGE_KEY_MEMBERS = 'retroplan_team_members_v4_media';
const STORAGE_KEY_INVITATIONS = 'retroplan_team_invitations_v4_media';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);

  // Team Members & Invitations State
  const [teamMembers, setTeamMembers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
      return saved ? JSON.parse(saved) : MOCK_USERS;
    } catch {
      return MOCK_USERS;
    }
  });

  const [invitations, setInvitations] = useState<TeamInvitation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INVITATIONS);
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'inv-1',
              email: 'sarah.lin@media-art.io',
              name: 'Sarah Lin',
              role: 'Projection Mapping Specialist',
              permissions: {
                canEditTimeline: true,
                canManageTasks: true,
                canEditDocs: true,
                canSyncDrive: true,
                isAdmin: false,
              },
              invitedAt: '2026-09-18',
              invitedBy: 'Berenger Recoules',
              status: 'pending',
              token: 'tok_sl9201',
              note: 'Hi Sarah! Please review our Echoes & Light media installation rétroplanning, 20K projector specs, and on-site testing checklist.',
            },
          ];
    } catch {
      return [];
    }
  });

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORKSPACES);
      return saved ? JSON.parse(saved) : INITIAL_WORKSPACES;
    } catch {
      return INITIAL_WORKSPACES;
    }
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(INITIAL_WORKSPACES[0].id);

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECTS[0].id);
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('retroplanning');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(INITIAL_PROJECTS[0].documents[0]?.id || null);

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTIFS);
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  // Google Auth State
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GOOGLE);
      return saved ? JSON.parse(saved) : DEFAULT_GOOGLE_ACCOUNT;
    } catch {
      return DEFAULT_GOOGLE_ACCOUNT;
    }
  });

  // API Key Settings State
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_API_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_API_SETTINGS;
    } catch {
      return DEFAULT_API_SETTINGS;
    }
  });

  // Tutorial Steps State
  const [tutorialSteps, setTutorialSteps] = useState<TutorialStep[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TUTORIAL);
      return saved ? JSON.parse(saved) : TUTORIAL_STEPS;
    } catch {
      return TUTORIAL_STEPS;
    }
  });

  const [isTutorialActive, setIsTutorialActive] = useState<boolean>(true);
  const [isTutorialDrawerOpen, setIsTutorialDrawerOpen] = useState<boolean>(false);
  const [isInteractiveDemoOpen, setIsInteractiveDemoOpen] = useState<boolean>(false);
  const [isDemoPlaying, setIsDemoPlaying] = useState<boolean>(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  // Modals state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isGoogleLoginOpen, setIsGoogleLoginOpen] = useState(false);
  const [isImplementationPlanOpen, setIsImplementationPlanOpen] = useState(false);
  const [isDatabaseTesterOpen, setIsDatabaseTesterOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(teamMembers));
    } catch (e) {}
  }, [teamMembers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INVITATIONS, JSON.stringify(invitations));
    } catch (e) {}
  }, [invitations]);

  // Sync state to localStorage with robust storage service and dual snapshotting
  useEffect(() => {
    RobustStorageService.setItem(STORAGE_KEY_PROJECTS, projects);
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GOOGLE, JSON.stringify(googleAccount));
    } catch (e) {}
  }, [googleAccount]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_API_SETTINGS, JSON.stringify(apiSettings));
    } catch (e) {}
  }, [apiSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TUTORIAL, JSON.stringify(tutorialSteps));
    } catch (e) {}
  }, [tutorialSteps]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications));
    } catch (e) {}
  }, [notifications]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeDocument =
    activeProject?.documents.find((d) => d.id === activeDocumentId) ||
    activeProject?.documents[0] ||
    null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNotification = (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      ...notif,
      timestamp: 'Just now',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Google Login / Logout handlers
  const loginWithGoogle = (email = 'berenger.recoules@gmail.com', name = 'Berenger Recoules') => {
    const account: GoogleAccount = {
      isSignedIn: true,
      name,
      email,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      accessToken: `ya29.${Date.now()}_client_oauth_token`,
      grantedScopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      connectedAt: new Date().toLocaleString(),
    };
    setGoogleAccount(account);
    addNotification({
      title: 'Google Account Connected',
      message: `Signed in as ${email}. Google Drive sync & document exports enabled.`,
      type: 'status_update',
    });
  };

  const logoutGoogle = () => {
    setGoogleAccount({
      isSignedIn: false,
      name: '',
      email: '',
      avatar: '',
      grantedScopes: [],
    });
    addNotification({
      title: 'Google Account Disconnected',
      message: 'Switched to local workspace storage mode.',
      type: 'status_update',
    });
  };

  const updateApiSettings = (settings: Partial<ApiSettings>) => {
    setApiSettings((prev) => ({ ...prev, ...settings }));
  };

  const testCurrentApiKey = async (): Promise<{ valid: boolean; message?: string }> => {
    updateApiSettings({ status: 'testing' });
    const keyToTest = apiSettings.useCustomKey ? apiSettings.apiKey : undefined;
    const res = await validateGeminiApiKey(keyToTest, apiSettings.selectedModel);
    if (res.valid) {
      updateApiSettings({
        status: 'connected',
        latencyMs: res.latencyMs || 120,
        lastValidated: `Active (${res.source === 'client-key' ? 'Custom API Key' : 'Server GenAI Engine'})`,
      });
      return { valid: true, message: `Connected to ${res.model} (${res.latencyMs || 120}ms latency)` };
    } else {
      updateApiSettings({
        status: 'invalid',
        lastValidated: 'Validation failed',
      });
      return { valid: false, message: res.error || 'Failed to authenticate with Gemini API.' };
    }
  };

  // Tutorial actions
  const completeTutorialStep = (stepId: string) => {
    setTutorialSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, completed: true } : s))
    );
  };

  const startTutorial = () => {
    // Switch to tutorial project and first tab
    setActiveProjectId(TUTORIAL_PROJECT.id);
    setActiveViewTab('retroplanning');
    setIsTutorialActive(true);
    setIsTutorialDrawerOpen(true);
    addNotification({
      title: '🎓 Tutorial Started',
      message: 'Explore the 7 interactive steps to master rétroplanning, task workflows, and team collaboration.',
      type: 'ai_insight',
    });
  };

  const resetTutorial = () => {
    setTutorialSteps(TUTORIAL_STEPS);
    setIsTutorialActive(true);
    setActiveProjectId(TUTORIAL_PROJECT.id);
    setActiveViewTab('retroplanning');
  };

  // Team Member & Invitation Management
  const inviteCollaborator = (
    email: string,
    name: string,
    role: string,
    permissions: CollaboratorPermissions,
    note?: string
  ) => {
    const newMemberId = `user-${Date.now()}`;
    const avatarSeeds = [
      '1534528741775-53994a69daeb',
      '1507003211169-0a1dd7228f2d',
      '1494790108377-be9c29b29330',
      '1517841905240-472988babdf9',
      '1500648767791-00dcc994a43e',
    ];
    const chosenSeed = avatarSeeds[teamMembers.length % avatarSeeds.length];

    const newMember: User = {
      id: newMemberId,
      name: name.trim() || email.split('@')[0],
      email: email.trim(),
      avatar: `https://images.unsplash.com/photo-${chosenSeed}?w=120&auto=format&fit=crop&q=80`,
      role: role || 'UI/UX Designer',
      color: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'][teamMembers.length % 6],
      status: 'active',
    };

    const newInvitation: TeamInvitation = {
      id: `inv-${Date.now()}`,
      email: email.trim(),
      name: newMember.name,
      role: newMember.role,
      permissions,
      invitedAt: new Date().toISOString().split('T')[0],
      invitedBy: currentUser.name,
      status: 'accepted',
      token: `tok_${Math.random().toString(36).substring(2, 10)}`,
      note,
    };

    setTeamMembers((prev) => [...prev, newMember]);
    setInvitations((prev) => [newInvitation, ...prev]);

    // Add to current active workspace members list
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === activeWorkspaceId
          ? { ...ws, members: [...(ws.members || []), newMember] }
          : ws
      )
    );

    addHistoryLog({
      actionType: 'create',
      targetType: 'project',
      targetTitle: 'Team Invitation',
      description: `Invited and onboarded ${newMember.name} (${email}) as ${role} with active permissions.`,
    });

    addNotification({
      title: '🎉 Collaborator Onboarded',
      message: `${newMember.name} joined as ${role}. You can now assign design deliverables to them!`,
      type: 'mention',
      projectId: activeProjectId,
    });
  };

  const removeTeamMember = (userId: string) => {
    setTeamMembers((prev) => prev.filter((u) => u.id !== userId));
    addNotification({
      title: 'Member Removed',
      message: 'Collaborator removed from workspace.',
      type: 'status_update',
    });
  };

  const updateTeamMemberRole = (userId: string, newRole: string) => {
    setTeamMembers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    addNotification({
      title: 'Member Role Updated',
      message: `Updated role to ${newRole}.`,
      type: 'status_update',
    });
  };

  const revokeInvitation = (invitationId: string) => {
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    addNotification({
      title: 'Invitation Revoked',
      message: 'Invitation link invalidated.',
      type: 'status_update',
    });
  };

  // Live Interactive Feature Demonstration
  const runLiveFeatureDemonstration = async (stepId: string) => {
    setIsDemoPlaying(true);
    const targetStep = tutorialSteps.find((s) => s.id === stepId) || tutorialSteps[0];

    // 1. Switch to the appropriate view
    setActiveViewTab(targetStep.targetTab);

    // 2. Perform live demonstration action based on step
    if (stepId === 'tut-1') {
      const curDate = activeProject.targetDeliveryDate;
      const testDate = curDate.endsWith('20') ? '2026-11-25' : '2026-11-20';
      updateTargetDeliveryDate(testDate);
      addNotification({
        title: '⚡ Live Rétroplanning Demonstration',
        message: `Set target launch to ${testDate}. The backward scheduling engine recalculated all task buffers automatically!`,
        type: 'status_update',
        projectId: activeProjectId,
      });
    } else if (stepId === 'tut-2') {
      addNotification({
        title: '⚡ Live Immediate Triage Demo',
        message: 'Triaged urgent deliverables, countdown clock, and open design clarifications.',
        type: 'deadline_warning',
        projectId: activeProjectId,
      });
    } else if (stepId === 'tut-3') {
      const demoTask: Omit<Task, 'id'> = {
        projectId: activeProjectId,
        phaseId: activeProject.phases[0]?.id || 'p1',
        title: '✨ Live Demo: Figma Component Tokens & Specs',
        description: 'Demonstrating live drag-and-drop task workflow and checklist progress tracking.',
        status: 'in-progress',
        priority: 'urgent',
        assigneeId: teamMembers[0]?.id || 'user-1',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: activeProject.targetDeliveryDate,
        estimatedHours: 8,
        dependencies: [],
        deliverables: ['Figma Token Studio Export', 'W3C Design Token JSON'],
        checklist: [
          { id: 'c1', text: 'Color contrast AA/AAA validation', completed: true },
          { id: 'c2', text: 'Stepped typographic scale ratio', completed: true },
          { id: 'c3', text: 'Motion duration curve tokens', completed: false },
        ],
        tags: ['Design System', 'Tokens', 'Demo'],
        isCriticalPath: true,
      };
      addTask(demoTask);
      addNotification({
        title: '⚡ Live Task Demonstration',
        message: 'Created and moved sample design task to "In Progress" with live checklist progress.',
        type: 'status_update',
        projectId: activeProjectId,
      });
    } else if (stepId === 'tut-4') {
      if (activeProject.documents.length > 0) {
        setActiveDocumentId(activeProject.documents[0].id);
      }
      addNotification({
        title: '⚡ Live Markdown Studio Demo',
        message: 'Opened live Markdown editor with live Table of Contents and deliverable task synchronization.',
        type: 'ai_insight',
        projectId: activeProjectId,
      });
    } else if (stepId === 'tut-5') {
      setIsInviteModalOpen(true);
    } else if (stepId === 'tut-6') {
      setIsDriveModalOpen(true);
    } else if (stepId === 'tut-7') {
      setIsDatabaseTesterOpen(true);
    }

    completeTutorialStep(stepId);
    setTimeout(() => {
      setIsDemoPlaying(false);
    }, 1000);
  };

  // Project Actions
  const createProject = (newProj: Partial<Project>) => {
    const proj: Project = {
      id: `proj-${Date.now()}`,
      workspaceId: activeWorkspaceId,
      title: newProj.title || 'Untitled Project',
      clientName: newProj.clientName || 'Internal',
      description: newProj.description || '',
      status: 'on-track',
      targetDeliveryDate: newProj.targetDeliveryDate || '2026-11-20',
      startDate: newProj.startDate || new Date().toISOString().split('T')[0],
      phases: newProj.phases || [],
      tasks: newProj.tasks || [],
      milestones: newProj.milestones || [],
      documents: newProj.documents || [],
      history: newProj.history || [],
      comments: [],
      clarificationQuestions: newProj.clarificationQuestions || [],
      retroplanningScore: newProj.retroplanningScore || 90,
      tags: newProj.tags || ['Design'],
    };

    setProjects((prev) => [proj, ...prev]);
    setActiveProjectId(proj.id);
    addNotification({
      title: 'New Project Initialized',
      message: `Project "${proj.title}" created with target delivery on ${proj.targetDeliveryDate}.`,
      type: 'status_update',
      projectId: proj.id,
    });
  };

  const updateProject = (updatedProj: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, ...updatedProj } : p))
    );
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      }
    }
  };

  const updateTargetDeliveryDate = (date: string) => {
    const oldDate = activeProject.targetDeliveryDate;
    updateProject({ targetDeliveryDate: date });
    addHistoryLog({
      actionType: 'retroplan_shift',
      targetType: 'timeline',
      targetTitle: 'Target Delivery Anchor',
      description: `Shifted launch deadline from ${oldDate} to ${date}. Recalculating retroplanning buffers.`,
      diff: { field: 'targetDeliveryDate', oldVal: oldDate, newVal: date },
    });
    addNotification({
      title: 'Rétroplanning Anchor Updated',
      message: `Target launch adjusted to ${date}. Backwards schedule refreshed.`,
      type: 'deadline_warning',
      projectId: activeProjectId,
    });
  };

  // Task Actions
  const addTask = (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ...taskData,
    };

    const updatedTasks = [...activeProject.tasks, newTask];
    updateProject({ tasks: updatedTasks });

    addHistoryLog({
      actionType: 'create',
      targetType: 'task',
      targetTitle: newTask.title,
      description: `Added task "${newTask.title}" to phase.`,
    });

    addNotification({
      title: 'Task Created',
      message: `"${newTask.title}" added to ${activeProject.title}`,
      type: 'status_update',
      projectId: activeProjectId,
      taskId: newTask.id,
    });
  };

  const updateTask = (updatedTask: Task) => {
    const existing = activeProject.tasks.find((t) => t.id === updatedTask.id);
    const updatedTasks = activeProject.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    updateProject({ tasks: updatedTasks });

    if (existing && existing.status !== updatedTask.status) {
      addHistoryLog({
        actionType: 'status_change',
        targetType: 'task',
        targetTitle: updatedTask.title,
        description: `Changed status from ${existing.status} to ${updatedTask.status}`,
        diff: {
          field: 'status',
          oldVal: existing.status,
          newVal: updatedTask.status,
        },
      });
    }
  };

  const deleteTask = (id: string) => {
    const taskToDelete = activeProject.tasks.find((t) => t.id === id);
    const updatedTasks = activeProject.tasks.filter((t) => t.id !== id);
    updateProject({ tasks: updatedTasks });

    if (taskToDelete) {
      addHistoryLog({
        actionType: 'delete',
        targetType: 'task',
        targetTitle: taskToDelete.title,
        description: `Removed task "${taskToDelete.title}"`,
      });
    }
  };

  const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    const task = activeProject.tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask({ ...task, status: newStatus });
  };

  const toggleChecklistItem = (taskId: string, checklistItemId: string) => {
    const task = activeProject.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map((c) =>
      c.id === checklistItemId ? { ...c, completed: !c.completed } : c
    );

    updateTask({ ...task, checklist: updatedChecklist });
  };

  // Phase & Milestone Actions
  const updatePhaseDates = (phaseId: string, startDate: string, endDate: string) => {
    const updatedPhases = activeProject.phases.map((p) =>
      p.id === phaseId ? { ...p, startDate, endDate } : p
    );
    updateProject({ phases: updatedPhases });

    addHistoryLog({
      actionType: 'retroplan_shift',
      targetType: 'timeline',
      targetTitle: 'Phase Schedule Shift',
      description: `Adjusted phase duration to ${startDate} -> ${endDate}`,
    });
  };

  const addMilestone = (milestoneData: Omit<Milestone, 'id'>) => {
    const newMs: Milestone = {
      id: `ms-${Date.now()}`,
      ...milestoneData,
    };
    updateProject({ milestones: [...activeProject.milestones, newMs] });
    addHistoryLog({
      actionType: 'create',
      targetType: 'milestone',
      targetTitle: newMs.title,
      description: `Created hard deadline milestone "${newMs.title}" due ${newMs.targetDate}`,
    });
  };

  const toggleMilestoneComplete = (milestoneId: string) => {
    const ms = activeProject.milestones.find((m) => m.id === milestoneId);
    if (!ms) return;
    const updatedMs = activeProject.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    updateProject({ milestones: updatedMs });

    addHistoryLog({
      actionType: 'status_change',
      targetType: 'milestone',
      targetTitle: ms.title,
      description: `Marked milestone "${ms.title}" as ${!ms.completed ? 'COMPLETED' : 'PENDING'}`,
    });
  };

  // Document & Markdown Actions
  const saveDocument = (doc: MarkdownDoc) => {
    const updatedDocs = activeProject.documents.map((d) =>
      d.id === doc.id
        ? { ...doc, lastModified: new Date().toISOString(), lastModifiedBy: currentUser.name }
        : d
    );
    updateProject({ documents: updatedDocs });

    addHistoryLog({
      actionType: 'update',
      targetType: 'document',
      targetTitle: doc.title,
      description: `Saved revisions to markdown spec "${doc.title}"`,
    });
  };

  const createDocument = (docData: Omit<MarkdownDoc, 'id' | 'lastModified' | 'lastModifiedBy'>): MarkdownDoc => {
    const newDoc: MarkdownDoc = {
      id: `doc-${Date.now()}`,
      ...docData,
      lastModified: new Date().toISOString(),
      lastModifiedBy: currentUser.name,
    };

    updateProject({ documents: [newDoc, ...activeProject.documents] });
    setActiveDocumentId(newDoc.id);

    addHistoryLog({
      actionType: 'create',
      targetType: 'document',
      targetTitle: newDoc.title,
      description: `Created new markdown file "${newDoc.title}"`,
    });

    return newDoc;
  };

  const deleteDocument = (id: string) => {
    const doc = activeProject.documents.find((d) => d.id === id);
    const updatedDocs = activeProject.documents.filter((d) => d.id !== id);
    updateProject({ documents: updatedDocs });

    if (activeDocumentId === id) {
      setActiveDocumentId(updatedDocs[0]?.id || null);
    }

    if (doc) {
      addHistoryLog({
        actionType: 'delete',
        targetType: 'document',
        targetTitle: doc.title,
        description: `Deleted document "${doc.title}"`,
      });
    }
  };

  const importDroppedFiles = (files: { name: string; content: string }[]) => {
    const newDocs: MarkdownDoc[] = files.map((f, i) => ({
      id: `doc-import-${Date.now()}-${i}`,
      title: f.name,
      path: `imports/${f.name}`,
      content: f.content,
      tags: ['Imported', 'Raw Notes'],
      lastModified: new Date().toISOString(),
      lastModifiedBy: currentUser.name,
    }));

    updateProject({ documents: [...newDocs, ...activeProject.documents] });
    if (newDocs[0]) {
      setActiveDocumentId(newDocs[0].id);
    }

    addNotification({
      title: 'Markdown Files Imported',
      message: `Imported ${files.length} unstructured markdown file(s). Ready for Gemini AI structuring.`,
      type: 'ai_insight',
      projectId: activeProjectId,
    });
  };

  const applyAiStructuredData = (structuredData: any) => {
    const { phases, milestones, tasks, clarificationQuestions, retroplanningScore, summary } =
      structuredData;

    const formattedTasks: Task[] = (tasks || []).map((t: any, idx: number) => ({
      id: t.id || `task-ai-${Date.now()}-${idx}`,
      projectId: activeProjectId,
      phaseId: t.phaseId || activeProject.phases[0]?.id || 'phase-1',
      title: t.title || 'Untitled Deliverable',
      description: t.description || '',
      status: (t.status as TaskStatus) || 'todo',
      priority: t.priority || 'medium',
      assigneeId: t.assigneeId || currentUser.id,
      startDate: t.startDate || activeProject.startDate,
      dueDate: t.dueDate || activeProject.targetDeliveryDate,
      estimatedHours: t.estimatedHours || 12,
      dependencies: t.dependencies || [],
      deliverables: t.deliverables || ['Design Deliverable'],
      checklist: t.checklist || [{ id: `c-${Date.now()}`, text: 'Initial review', completed: false }],
      tags: t.tags || ['Design', 'AI-Generated'],
      isCriticalPath: Boolean(t.isCriticalPath),
    }));

    updateProject({
      phases: phases && phases.length > 0 ? phases : activeProject.phases,
      milestones: milestones && milestones.length > 0 ? milestones : activeProject.milestones,
      tasks: formattedTasks.length > 0 ? formattedTasks : activeProject.tasks,
      clarificationQuestions: clarificationQuestions || activeProject.clarificationQuestions,
      retroplanningScore: retroplanningScore || 92,
    });

    addHistoryLog({
      actionType: 'ai_restructure',
      targetType: 'project',
      targetTitle: activeProject.title,
      description: `Gemini AI specialist structured ${formattedTasks.length} tasks and calculated backwards retroplanning buffers.`,
    });

    addNotification({
      title: 'Gemini AI Plan Applied',
      message: `Structured project with ${formattedTasks.length} tasks and ${phases?.length || 3} retroplanning phases.`,
      type: 'ai_insight',
      projectId: activeProjectId,
    });
  };

  const addComment = (
    content: string,
    targetType: 'task' | 'milestone' | 'document' | 'project',
    targetId: string
  ) => {
    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      timestamp: 'Just now',
      content,
      targetType,
      targetId,
    };

    updateProject({ comments: [newComment, ...activeProject.comments] });
    addNotification({
      title: 'New Team Comment',
      message: `${currentUser.name}: "${content.slice(0, 50)}..."`,
      type: 'mention',
      projectId: activeProjectId,
    });
  };

  const addHistoryLog = (
    entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'userId' | 'userName' | 'userAvatar'>
  ) => {
    const newHistory: HistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      ...entry,
    };

    updateProject({ history: [newHistory, ...activeProject.history] });
  };

  const revertHistoryState = (entry: HistoryEntry) => {
    if (!entry.diff) return;

    if (entry.targetType === 'task' && entry.diff.field === 'status') {
      const task = activeProject.tasks.find((t) => t.title === entry.targetTitle);
      if (task) {
        updateTaskStatus(task.id, entry.diff.oldVal as TaskStatus);
        addNotification({
          title: 'Reverted Task Status',
          message: `Reverted "${task.title}" back to ${entry.diff.oldVal}`,
          type: 'status_update',
        });
      }
    } else if (entry.diff.field === 'targetDeliveryDate') {
      updateTargetDeliveryDate(entry.diff.oldVal);
    }
  };

  const resolveClarification = (id: string, response: string) => {
    const updatedQs = activeProject.clarificationQuestions.map((q) =>
      q.id === id ? { ...q, resolved: true, userResponse: response } : q
    );
    updateProject({ clarificationQuestions: updatedQs });

    addHistoryLog({
      actionType: 'update',
      targetType: 'project',
      targetTitle: 'Ambiguity Resolution',
      description: `Resolved design question: "${response}"`,
    });

    addNotification({
      title: 'Clarification Resolved',
      message: `Recorded decision: "${response}"`,
      type: 'status_update',
    });
  };

  const exportProjectAsMarkdown = () => {
    let md = `# Project Rétroplanning: ${activeProject.title}\n`;
    md += `**Client**: ${activeProject.clientName} | **Target Launch**: ${activeProject.targetDeliveryDate}\n`;
    md += `**Buffer Health Score**: ${activeProject.retroplanningScore}%\n\n`;

    md += `## Phases\n`;
    activeProject.phases.forEach((p) => {
      md += `### ${p.name} (${p.startDate} - ${p.endDate})\n`;
      md += `- Buffer: ${p.bufferDays} days | Critical Path: ${p.isCriticalPath ? 'YES' : 'NO'}\n`;
    });

    md += `\n## Milestones\n`;
    activeProject.milestones.forEach((m) => {
      md += `- [${m.completed ? 'x' : ' '}] **${m.targetDate}** - ${m.title} (${m.deliverableCount} deliverables): ${m.description}\n`;
    });

    md += `\n## Tasks & Deliverables\n`;
    activeProject.tasks.forEach((t) => {
      md += `### ${t.title} [${t.status.toUpperCase()}]\n`;
      md += `- **Timeline**: ${t.startDate} to ${t.dueDate} (${t.estimatedHours}h)\n`;
      md += `- **Deliverables**: ${t.deliverables.join(', ')}\n`;
      if (t.checklist.length > 0) {
        md += `- **Checklist**:\n`;
        t.checklist.forEach((c) => {
          md += `  - [${c.completed ? 'x' : ' '}] ${c.text}\n`;
        });
      }
      md += `\n`;
    });

    return md;
  };

  const exportProjectAsJson = () => {
    return JSON.stringify(activeProject, null, 2);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        workspaces,
        activeWorkspace,
        setActiveWorkspaceId,
        projects,
        activeProject,
        setActiveProjectId,
        activeViewTab,
        setActiveViewTab,
        notifications,
        unreadCount,
        markNotificationRead,
        markAllNotificationsRead,
        addNotification,
        googleAccount,
        loginWithGoogle,
        logoutGoogle,
        apiSettings,
        updateApiSettings,
        testCurrentApiKey,
        isApiSettingsOpen,
        setIsApiSettingsOpen,
        isGoogleLoginOpen,
        setIsGoogleLoginOpen,
        tutorialSteps,
        isTutorialActive,
        isTutorialDrawerOpen,
        setIsTutorialDrawerOpen,
        isInteractiveDemoOpen,
        setIsInteractiveDemoOpen,
        isDemoPlaying,
        startTutorial,
        completeTutorialStep,
        resetTutorial,
        runLiveFeatureDemonstration,
        teamMembers,
        invitations,
        inviteCollaborator,
        removeTeamMember,
        updateTeamMemberRole,
        revokeInvitation,
        isInviteModalOpen,
        setIsInviteModalOpen,
        isImplementationPlanOpen,
        setIsImplementationPlanOpen,
        createProject,
        updateProject,
        deleteProject,
        addTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
        toggleChecklistItem,
        updatePhaseDates,
        addMilestone,
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
        revertHistoryState,
        resolveClarification,
        isDriveModalOpen,
        setIsDriveModalOpen,
        isAiAssistantOpen,
        setIsAiAssistantOpen,
        isCreateTaskModalOpen,
        setIsCreateTaskModalOpen,
        isCreateProjectModalOpen,
        setIsCreateProjectModalOpen,
        isDatabaseTesterOpen,
        setIsDatabaseTesterOpen,
        exportProjectAsMarkdown,
        exportProjectAsJson,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
