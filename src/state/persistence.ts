/**
 * The only module that touches localStorage. One versioned namespace (`rps_v1_*`), one slice per
 * key, every read/write wrapped in try/catch, and `save()` REPORTS failure instead of hiding it.
 *
 * Also: one-time migration from the old `retroplan_*_v4_media` keys, full-store JSON backup /
 * restore, single-project import, and a small real self-test for a diagnostics panel.
 */
import type {
  AiSettings,
  CloudAccounts,
  CloudSettings,
  Notification,
  Project,
  TeamInvitation,
  Theme,
  TutorialStep,
  User,
  ViewTab,
  Workspace,
} from '../types';
import { parseProjectJson } from '../services/export/json';
import { newId } from './ids';

export const NAMESPACE = 'rps_v1_';

export interface UiState {
  activeProjectId: string | null;
  activeViewTab: ViewTab;
  activeDocumentId: string | null;
  currentUserId: string | null;
  activeWorkspaceId: string | null;
  theme: Theme;
}

export interface PersistedState {
  projects?: Project[];
  workspaces?: Workspace[];
  teamMembers?: User[];
  invitations?: TeamInvitation[];
  notifications?: Notification[];
  aiSettings?: AiSettings;
  cloudSettings?: CloudSettings;
  cloudAccounts?: CloudAccounts;
  tutorial?: TutorialStep[];
  ui?: Partial<UiState>;
}

export type Slice = keyof PersistedState;

export const SLICES: readonly Slice[] = [
  'projects',
  'workspaces',
  'teamMembers',
  'invitations',
  'notifications',
  'aiSettings',
  'cloudSettings',
  'cloudAccounts',
  'tutorial',
  'ui',
];

const ARRAY_SLICES: ReadonlySet<Slice> = new Set<Slice>(['projects', 'workspaces', 'teamMembers', 'invitations', 'notifications', 'tutorial']);

export const MIGRATED_KEY = `${NAMESPACE}migratedAt`;

/** Minimal storage surface so tests can pass a Map-backed stub. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

export function keyFor(slice: Slice): string {
  return `${NAMESPACE}${slice}`;
}

function defaultStorage(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: StorageLike }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function readJson<T>(storage: StorageLike, key: string): { value?: T; error?: string } {
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return {};
    return { value: JSON.parse(raw) as T };
  } catch (err) {
    return { error: `${key}: ${err instanceof Error ? err.message : 'unreadable'}` };
  }
}

function listKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  if (typeof storage.key !== 'function' || typeof storage.length !== 'number') return keys;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** Writes one slice. Never throws; a quota or availability problem comes back as `{ok:false, error}`. */
export function save<S extends Slice>(slice: S, value: PersistedState[S], storage: StorageLike | null = defaultStorage()): SaveResult {
  if (!storage) return { ok: false, error: 'localStorage is not available in this environment.' };
  try {
    storage.setItem(keyFor(slice), JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const quota = /quota|exceeded/i.test(message);
    return { ok: false, error: quota ? `Storage quota exceeded while saving ${slice}. Recent changes are NOT saved.` : `Could not save ${slice}: ${message}` };
  }
}

export interface LoadResult {
  state: PersistedState;
  /** True when the old `retroplan_*_v4_media` keys were migrated during this call. */
  migrated: boolean;
  /** Slices that existed but could not be parsed (they are skipped, not deleted). */
  errors: string[];
}

/** Reads every slice; runs the legacy migration on first run (when no `rps_v1_*` slice exists yet). */
export function load(storage: StorageLike | null = defaultStorage()): LoadResult {
  if (!storage) return { state: {}, migrated: false, errors: ['localStorage is not available in this environment.'] };
  const errors: string[] = [];
  const state: PersistedState = {};

  const hasNew = SLICES.some((s) => storage.getItem(keyFor(s)) !== null) || storage.getItem(MIGRATED_KEY) !== null;
  let migrated = false;
  if (!hasNew) {
    const legacy = migrateLegacy(storage);
    if (legacy) {
      migrated = true;
      for (const slice of SLICES) {
        const v = legacy[slice];
        if (v !== undefined) {
          const res = save(slice, v as never, storage);
          if (!res.ok) errors.push(res.error ?? `Could not write migrated ${slice}`);
        }
      }
      try {
        storage.setItem(MIGRATED_KEY, new Date().toISOString());
      } catch {
        /* the migration itself succeeded; the marker is best-effort */
      }
    }
  }

  for (const slice of SLICES) {
    const { value, error } = readJson<unknown>(storage, keyFor(slice));
    if (error) {
      errors.push(error);
      continue;
    }
    if (value === undefined) continue;
    if (ARRAY_SLICES.has(slice) ? !Array.isArray(value) : typeof value !== 'object' || value === null) {
      errors.push(`${keyFor(slice)}: unexpected shape, ignored`);
      continue;
    }
    (state as Record<string, unknown>)[slice] = value;
  }
  return { state, migrated, errors };
}

/** Removes every `rps_v1_*` key (used by "reset app data"). */
export function clearAll(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  for (const slice of SLICES) {
    try {
      storage.removeItem(keyFor(slice));
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy migration (retroplan_*_v4_media → rps_v1_*)
// ---------------------------------------------------------------------------

export const LEGACY_KEYS = {
  projects: 'retroplan_projects_v4_media',
  workspaces: 'retroplan_workspaces_v4_media',
  notifications: 'retroplan_notifs_v4_media',
  apiSettings: 'retroplan_api_settings_v4_media',
  tutorial: 'retroplan_tutorial_steps_v4_media',
  teamMembers: 'retroplan_team_members_v4_media',
  invitations: 'retroplan_team_invitations_v4_media',
  theme: 'retroplan_theme',
} as const;

function isoOr(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return fallback;
}

/**
 * Builds the new state from the old keys. Returns null when no old data exists. Old keys are left
 * untouched so a downgrade still finds them.
 */
export function migrateLegacy(storage: StorageLike): PersistedState | null {
  const now = new Date().toISOString();
  const out: PersistedState = {};
  let found = false;

  const projects = readJson<unknown>(storage, LEGACY_KEYS.projects).value;
  if (Array.isArray(projects) && projects.length > 0) {
    found = true;
    out.projects = projects.map((p) => {
      const project = p as Project;
      const strip = { ...project } as Project & Record<string, unknown>;
      // The legacy Drive link was never real; drop it rather than carry a fake "synced" flag forward.
      for (const k of ['driveSynced', 'driveFolderId', 'driveFolderName', 'driveFolderUrl', 'driveLastSyncedAt', 'driveSyncStatus']) delete strip[k];
      strip.history = Array.isArray(project.history) ? project.history.slice(0, 300) : [];
      strip.comments = Array.isArray(project.comments) ? project.comments.map((c) => ({ ...c, timestamp: isoOr(c.timestamp, now) })) : [];
      return strip as Project;
    });
  }

  const workspaces = readJson<unknown>(storage, LEGACY_KEYS.workspaces).value;
  if (Array.isArray(workspaces)) {
    found = true;
    out.workspaces = workspaces as Workspace[];
  }

  const members = readJson<unknown>(storage, LEGACY_KEYS.teamMembers).value;
  if (Array.isArray(members)) {
    found = true;
    out.teamMembers = members as User[];
  }

  const invitations = readJson<unknown>(storage, LEGACY_KEYS.invitations).value;
  if (Array.isArray(invitations)) {
    found = true;
    // The seeded demo invitation (id `inv-1`, a fake "accepted" state) is not real data.
    out.invitations = (invitations as TeamInvitation[]).filter((i) => i && i.id !== 'inv-1').map((i) => ({ ...i, invitedAt: isoOr(i.invitedAt, now) }));
  }

  const notifications = readJson<unknown>(storage, LEGACY_KEYS.notifications).value;
  if (Array.isArray(notifications)) {
    found = true;
    out.notifications = (notifications as Notification[])
      .filter((n) => n && typeof n.title === 'string')
      .slice(0, 100)
      .map((n) => ({ ...n, timestamp: isoOr(n.timestamp, now) }));
  }

  const tutorial = readJson<unknown>(storage, LEGACY_KEYS.tutorial).value;
  if (Array.isArray(tutorial)) {
    found = true;
    // Step text and shape changed; only the completion flags are worth keeping.
    out.tutorial = (tutorial as TutorialStep[]).map((s) => ({ ...s, completed: Boolean(s.completed) }));
  }

  const api = readJson<{ useCustomKey?: boolean; apiKey?: string; selectedModel?: string }>(storage, LEGACY_KEYS.apiSettings).value;
  if (api && typeof api === 'object') {
    found = true;
    if (api.useCustomKey && typeof api.apiKey === 'string' && api.apiKey.trim()) {
      const id = newId('ai');
      out.aiSettings = {
        providers: [
          {
            id,
            providerId: 'gemini',
            label: 'Gemini (migrated)',
            apiKey: api.apiKey.trim(),
            model: typeof api.selectedModel === 'string' && api.selectedModel ? api.selectedModel : 'gemini-2.5-flash',
            enabled: true,
          },
        ],
        defaultProviderId: id,
      };
    }
  }

  let theme: Theme | undefined;
  try {
    const t = storage.getItem(LEGACY_KEYS.theme);
    if (t === 'light' || t === 'dark') {
      theme = t;
      found = true;
    }
  } catch {
    /* ignore */
  }
  if (theme) out.ui = { theme };

  return found ? out : null;
}

// ---------------------------------------------------------------------------
// Backup / restore
// ---------------------------------------------------------------------------

export const BACKUP_FORMAT = 'rps-backup';
export const BACKUP_VERSION = 1;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Removes API keys and OAuth client secrets so a backup can be shared. */
export function stripSecrets(state: PersistedState): PersistedState {
  const out: PersistedState = { ...state };
  if (state.aiSettings) {
    out.aiSettings = {
      ...state.aiSettings,
      providers: state.aiSettings.providers.map((p) => {
        const { apiKey: _apiKey, ...rest } = p;
        return rest;
      }),
    };
  }
  if (state.cloudSettings) {
    const { clientSecret: _secret, ...google } = state.cloudSettings.google;
    out.cloudSettings = { ...state.cloudSettings, google };
  }
  return out;
}

/** Serialises the whole store (secrets stripped) as a versioned JSON envelope. */
export function exportAllJson(state: PersistedState): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: stripSecrets(state) }, null, 2);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parses and validates a backup produced by `exportAllJson`. Every project is run through
 * `parseProjectJson`; other slices are shape-checked. Throws `BackupError`; never writes.
 */
export function importAllJson(text: string): PersistedState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new BackupError(`Not valid JSON: ${err instanceof Error ? err.message : 'unparseable input'}`);
  }
  if (!isObject(raw)) throw new BackupError('Backup must be a JSON object.');
  if (raw.format !== BACKUP_FORMAT) throw new BackupError(`Not a RetroPlaningStudio backup (format "${String(raw.format)}").`);
  if (raw.version !== BACKUP_VERSION) throw new BackupError(`Unsupported backup version ${String(raw.version)} (expected ${BACKUP_VERSION}).`);
  if (!isObject(raw.data)) throw new BackupError('Backup "data" must be an object.');
  const data = raw.data;
  const out: PersistedState = {};

  for (const slice of SLICES) {
    const v = data[slice];
    if (v === undefined || v === null) continue;
    if (ARRAY_SLICES.has(slice)) {
      if (!Array.isArray(v)) throw new BackupError(`"data.${slice}" must be an array.`);
    } else if (!isObject(v)) {
      throw new BackupError(`"data.${slice}" must be an object.`);
    }
    (out as Record<string, unknown>)[slice] = v;
  }

  if (out.projects) {
    out.projects = out.projects.map((p, i) => {
      try {
        return parseProjectJson(JSON.stringify(p));
      } catch (err) {
        throw new BackupError(`data.projects[${i}]: ${err instanceof Error ? err.message : 'invalid project'}`);
      }
    });
  }
  for (const slice of ['teamMembers', 'workspaces', 'invitations', 'notifications', 'tutorial'] as const) {
    const items = out[slice];
    if (!items) continue;
    items.forEach((item, i) => {
      if (!isObject(item) || typeof item.id !== 'string' || !item.id) throw new BackupError(`"data.${slice}[${i}]" must have a string id.`);
    });
  }
  if (out.aiSettings) {
    if (!Array.isArray(out.aiSettings.providers)) throw new BackupError('"data.aiSettings.providers" must be an array.');
  }
  return out;
}

/** Parses a single project export (`projectToJson`). Throws `ProjectJsonError` from the export module. */
export function importProjectJson(text: string): Project {
  return parseProjectJson(text);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface StorageSelfTest {
  ok: boolean;
  message: string;
  /** Approximate bytes used by the `rps_v1_*` keys (UTF-16: 2 bytes per code unit). */
  usedBytes: number;
  keyCount: number;
}

/** Writes, reads back and removes one probe key, and measures what the app currently stores. */
export function runStorageSelfTest(storage: StorageLike | null = defaultStorage()): StorageSelfTest {
  if (!storage) return { ok: false, message: 'localStorage is not available.', usedBytes: 0, keyCount: 0 };
  const probeKey = `${NAMESPACE}probe`;
  const probe = `probe-${Date.now()}`;
  let ok = true;
  let message = 'Write, read and remove succeeded.';
  try {
    storage.setItem(probeKey, probe);
    if (storage.getItem(probeKey) !== probe) {
      ok = false;
      message = 'Read-back returned a different value.';
    }
    storage.removeItem(probeKey);
    if (storage.getItem(probeKey) !== null) {
      ok = false;
      message = 'Probe key could not be removed.';
    }
  } catch (err) {
    ok = false;
    message = `Storage write failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  let usedBytes = 0;
  let keyCount = 0;
  for (const k of listKeys(storage)) {
    if (!k.startsWith(NAMESPACE)) continue;
    keyCount++;
    try {
      usedBytes += (k.length + (storage.getItem(k)?.length ?? 0)) * 2;
    } catch {
      /* ignore */
    }
  }
  return { ok, message, usedBytes, keyCount };
}
