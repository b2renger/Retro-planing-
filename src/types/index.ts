import type { AiProviderConfig } from '../services/ai/types';
import type { CloudAccount, CloudProviderId } from '../services/cloud/types';
import type { SyncState } from '../services/cloud/syncEngine';

export type { AiProviderConfig, CloudAccount, CloudProviderId, SyncState };

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  color: string;
  status: 'active' | 'reviewing' | 'offline' | 'crunching';
  currentDocumentId?: string;
  currentTaskId?: string;
}

export type Theme = 'dark' | 'light' | 'system';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  projectIds: string[];
  members: User[];
}

export type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  phaseId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  estimatedHours: number;
  actualHours?: number;
  dependencies: string[]; // IDs of tasks this task depends on
  deliverables: string[];
  checklist: TaskChecklistItem[];
  tags: string[];
  markdownRef?: string;
  isCriticalPath?: boolean;
}

export interface Phase {
  id: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  order: number;
  bufferDays: number;
  isCriticalPath: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  isHardDeadline: boolean;
  completed: boolean;
  description: string;
  deliverableCount: number;
}

export interface MarkdownDoc {
  id: string;
  title: string;
  path: string; // e.g. "briefs/client_kickoff.md"
  content: string;
  lastModified: string;
  lastModifiedBy: string;
  tags: string[];
  autoStructured?: boolean;
  linkedTaskIds?: string[];
  yamlFrontmatter?: Record<string, any>;
}

export interface HistoryEntry {
  id: string;
  timestamp: string; // ISO 8601
  userId: string;
  userName: string;
  userAvatar: string;
  actionType: 'create' | 'update' | 'delete' | 'ai_restructure' | 'status_change' | 'retroplan_shift' | 'comment';
  targetType: 'task' | 'project' | 'document' | 'milestone' | 'timeline';
  targetTitle: string;
  description: string;
  diff?: {
    field: string;
    oldVal: string;
    newVal: string;
  };
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: string; // ISO 8601
  content: string;
  targetType: 'task' | 'milestone' | 'document' | 'project';
  targetId: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string; // ISO 8601
  type: 'deadline_warning' | 'status_update' | 'ai_insight' | 'dependency_blocked' | 'mention';
  read: boolean;
  projectId?: string;
  taskId?: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  reason: string;
  suggestedOptions: string[];
  resolved: boolean;
  userResponse?: string;
}

export interface HardwareItem {
  id: string;
  name: string;
  category: 'Projection' | 'Audio' | 'Media Server & Network' | 'Rigging & Power';
  quantity: number;
  specs: string;
  status: 'booked' | 'pending' | 'delivered' | 'tested';
  vendor?: string;
  notes?: string;
}

export interface MediaAssetItem {
  id: string;
  title: string;
  type: 'video' | 'sound';
  format: string;
  duration: string;
  status: 'planning' | 'in-production' | 'rendered' | 'approved';
  description: string;
}

/** Link between a project and its folder on a cloud provider (written by the sync layer). */
export interface ProjectCloudLink {
  providerId: CloudProviderId;
  folderId: string;
  docsFolderId: string;
  exportsFolderId?: string;
  projectFileId?: string;
  syncState: SyncState;
  lastSyncAt?: string; // ISO 8601
}

export interface Project {
  id: string;
  workspaceId: string;
  title: string;
  clientName: string;
  description: string;
  status: 'on-track' | 'at-risk' | 'in-review' | 'completed';
  targetDeliveryDate: string; // Target launch date for retroplanning
  startDate: string;
  phases: Phase[];
  tasks: Task[];
  milestones: Milestone[];
  documents: MarkdownDoc[];
  history: HistoryEntry[];
  comments: Comment[];
  clarificationQuestions: ClarificationQuestion[];
  /**
   * 0-100. Derived: `clamp(0, 100, 100 - 10 * overdueTasks - (scheduleEndsAfterTarget ? 30 : 0))`,
   * recomputed by the reducer on every mutation. Prefer `computeProjectHealth()` in the UI.
   */
  retroplanningScore: number;
  tags: string[];
  hardwareItems?: HardwareItem[];
  mediaAssets?: MediaAssetItem[];
  cloud?: ProjectCloudLink;
  isTutorialTemplate?: boolean;
  /** @deprecated Legacy Drive fields from the v4 store; never written any more. Kept only so old exports still parse. */
  driveSynced?: boolean;
  /** @deprecated See `driveSynced`. */
  driveFolderId?: string;
  /** @deprecated See `driveSynced`. */
  driveFolderName?: string;
  /** @deprecated See `driveSynced`. */
  driveFolderUrl?: string;
  /** @deprecated See `driveSynced`. */
  driveLastSyncedAt?: string;
  /** @deprecated See `driveSynced`. */
  driveSyncStatus?: 'synced' | 'syncing' | 'unlinked' | 'error';
}

export interface CollaboratorPermissions {
  canEditTimeline: boolean;
  canManageTasks: boolean;
  canEditDocs: boolean;
  canSyncDrive: boolean;
  isAdmin: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: CollaboratorPermissions;
  invitedAt: string; // ISO 8601
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  token: string;
  note?: string;
}

export type ViewTab = 'immediate' | 'retroplanning' | 'hardware' | 'tasks' | 'markdown' | 'collaboration' | 'history';

/** AI provider settings. `apiKey` values are kept out of localStorage when a secure store exists (see src/state/secrets.ts). */
export interface AiSettings {
  providers: AiProviderConfig[];
  defaultProviderId: string | null;
}

/** OAuth client registrations entered by the user for the cloud providers. */
export interface CloudSettings {
  google: { clientId: string; clientSecret?: string };
  onedrive: { clientId: string };
}

/**
 * `expired` is deliberately NOT `error`: a Google refresh token issued by a project in Testing
 * mode dies after seven days (the price of the restricted `drive` scope), so an expired sign-in
 * is a routine, expected event with a one-click cure. The UI must never dress it as a failure.
 */
export interface CloudStatus {
  state: 'idle' | 'syncing' | 'ok' | 'error' | 'expired';
  message?: string;
  lastSyncAt?: string; // ISO 8601
  /** Which account needs signing in again. Only set with `state: 'expired'`. */
  providerId?: CloudProviderId;
}

export type CloudAccounts = Partial<Record<CloudProviderId, CloudAccount>>;
