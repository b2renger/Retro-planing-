/**
 * Glue between the UI and `src/services/cloud/**`: provider construction from the user's own
 * OAuth client ids, the copy the setup screen needs (redirect URI, scopes), and the pure
 * comparisons the cloud panel renders. Nothing here performs a sync — see `useCloudSync.ts`.
 */
import { createGoogleDriveProvider } from '../services/cloud/googleDrive';
import { docFileName } from '../services/cloud/layout';
import { createOneDriveProvider } from '../services/cloud/oneDrive';
import { PROVIDER_OAUTH, WEB_CALLBACK_PATH } from '../services/cloud/oauth';
import { isLater, isSyncableDoc, type RemoteSnapshot, type SyncState, type SyncSummary } from '../services/cloud/syncEngine';
import type { CloudOAuthConfig, CloudProvider, CloudProviderId } from '../services/cloud/types';
import type { CloudSettings, Project, ProjectCloudLink } from '../types';

/** Display names, in the wording each vendor uses. */
export const PROVIDER_LABELS: Record<CloudProviderId, string> = {
  google: 'Google Drive',
  onedrive: 'Microsoft OneDrive',
};

/** Where the user creates the OAuth client this app needs. */
export const PROVIDER_CONSOLE: Record<CloudProviderId, { label: string; url: string }> = {
  google: { label: 'Google Cloud console → Credentials', url: 'https://console.cloud.google.com/apis/credentials' },
  onedrive: { label: 'Microsoft Entra → App registrations', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' },
};

/** Plain-language meaning of every scope the app asks for. Keys must match `PROVIDER_OAUTH`. */
export const SCOPE_MEANINGS: Record<string, string> = {
  'https://www.googleapis.com/auth/drive':
    'Read and write files in your Drive. The narrower “drive.file” scope is not enough: a file you drop into the project folder yourself would be invisible to the sync.',
  'https://www.googleapis.com/auth/userinfo.email': 'Read your email address, to show which account is connected.',
  'https://www.googleapis.com/auth/userinfo.profile': 'Read your name, to show which account is connected.',
  'Files.ReadWrite': 'Read and write files in your OneDrive.',
  'User.Read': 'Read your name and email address, to show which account is connected.',
  offline_access: 'Stay signed in, so background sync does not ask you to sign in again every hour.',
};

/** `[scope, what it allows]` for the settings screen. */
export function scopeExplanations(providerId: CloudProviderId): Array<{ scope: string; meaning: string }> {
  return PROVIDER_OAUTH[providerId].scopes.map((scope) => ({ scope, meaning: SCOPE_MEANINGS[scope] ?? 'Requested by the provider.' }));
}

/** True when the Electron bridge is present, i.e. sign-in uses the loopback flow. */
export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.desktop?.oauthLoopback);
}

/** What the user must register as a redirect URI, for this build and this provider. */
export interface RedirectAdvice {
  /** `true` on desktop, where the port changes per attempt and there is no single URI. */
  loopback: boolean;
  /** The exact string to register (web), or the loopback prefix that must be allowed (desktop). */
  value: string;
  /** Provider-specific instruction, spelled out because this is the usual cause of a failed setup. */
  detail: string;
}

/**
 * Computes the redirect URI advice. `origin` defaults to `location.origin`; `desktop` defaults
 * to `isDesktopRuntime()`. Both are parameters so this stays testable outside a browser.
 */
export function redirectAdvice(providerId: CloudProviderId, opts: { desktop?: boolean; origin?: string } = {}): RedirectAdvice {
  const desktop = opts.desktop ?? isDesktopRuntime();
  const origin = opts.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (desktop) {
    return {
      loopback: true,
      value: 'http://127.0.0.1',
      detail:
        providerId === 'google'
          ? 'The desktop app starts a loopback server on a new port for every sign-in, so there is no fixed URI to paste. Create the credential as an OAuth client of type “Desktop app” — that type accepts any http://127.0.0.1:<port> redirect. A “Web application” client will refuse it.'
          : 'The desktop app starts a loopback server on a new port for every sign-in. In the app registration, add the “Mobile and desktop applications” platform and register http://localhost — Entra then accepts any loopback port. Do not use the “Web” platform.',
    };
  }
  return {
    loopback: false,
    value: `${origin}${WEB_CALLBACK_PATH}`,
    detail:
      providerId === 'google'
        ? 'Create an OAuth client of type “Web application”, paste this string into “Authorized redirect URIs” exactly as shown, and add the origin above it under “Authorized JavaScript origins”.'
        : 'In the app registration, add the “Single-page application” platform and paste this string as its redirect URI, exactly as shown.',
  };
}

/** The OAuth client the user entered for a provider. */
export function oauthConfig(settings: CloudSettings, providerId: CloudProviderId): CloudOAuthConfig {
  return providerId === 'google'
    ? { clientId: settings.google.clientId.trim(), clientSecret: settings.google.clientSecret?.trim() || undefined }
    : { clientId: settings.onedrive.clientId.trim() };
}

/** A provider bound to the stored tokens. Throws when no client id has been entered. */
export function createProvider(settings: CloudSettings, providerId: CloudProviderId): CloudProvider {
  const cfg = oauthConfig(settings, providerId);
  if (!cfg.clientId) throw new Error(`Enter the ${PROVIDER_LABELS[providerId]} client ID in Settings → Cloud sync first.`);
  return providerId === 'google' ? createGoogleDriveProvider(cfg) : createOneDriveProvider(cfg);
}

/** The sync state carried by a project link. */
export function syncStateOf(link: ProjectCloudLink): SyncState {
  return link.syncState;
}

/** Rebuilds the project link from a sync state returned by the engine. */
export function linkFromSyncState(state: SyncState): ProjectCloudLink {
  return {
    providerId: state.providerId,
    folderId: state.projectFolderId,
    docsFolderId: state.docsFolderId,
    exportsFolderId: state.exportsFolderId,
    projectFileId: state.projectFileId,
    syncState: state,
    lastSyncAt: state.lastSyncAt,
  };
}

/**
 * Best available stamp of the last local change to project-level data. History is prepended by
 * the reducer, so entry 0 is the newest. Returns `undefined` for a project with no history,
 * which makes `planSync` upload project.json only when it is missing remotely.
 */
export function lastLocalChangeOf(project: Project): string | undefined {
  return project.history[0]?.timestamp;
}

/** How one document stands relative to its cloud copy. */
export type DocSyncState = 'in-sync' | 'local-newer' | 'remote-newer' | 'both-changed' | 'local-only' | 'remote-only' | 'remote-deleted';

/** Human label for each state, phrased from the user's point of view. */
export const DOC_STATE_LABELS: Record<DocSyncState, string> = {
  'in-sync': 'In sync',
  'local-newer': 'Newer here',
  'remote-newer': 'Newer in the cloud',
  'both-changed': 'Changed on both sides',
  'local-only': 'Not uploaded yet',
  'remote-only': 'Not downloaded yet',
  'remote-deleted': 'Removed from the cloud',
};

/** One row of the file list in the cloud panel. */
export interface DocStatusRow {
  key: string;
  name: string;
  state: DocSyncState;
  /** ISO timestamp of the newest side, when known. */
  modified?: string;
}

/**
 * Compares the local documents with a remote snapshot using the bookkeeping of the last sync.
 * Pure: the panel renders exactly what this returns and never guesses.
 */
export function compareDocuments(project: Project, snapshot: RemoteSnapshot, state: SyncState): DocStatusRow[] {
  const remoteFiles = snapshot.remoteDocs.filter(isSyncableDoc);
  const remoteById = new Map(remoteFiles.map((f) => [f.id, f]));
  const matched = new Set<string>();
  const rows: DocStatusRow[] = [];

  for (const doc of project.documents) {
    const entry = state.files[doc.id];
    const remote = entry ? remoteById.get(entry.fileId) : undefined;
    if (remote) matched.add(remote.id);
    if (!entry) {
      rows.push({ key: doc.id, name: docFileName(doc.title), state: 'local-only', modified: doc.lastModified });
      continue;
    }
    if (!remote) {
      rows.push({ key: doc.id, name: docFileName(doc.title), state: 'remote-deleted', modified: doc.lastModified });
      continue;
    }
    const localChanged = isLater(doc.lastModified, entry.localModified);
    const remoteChanged = isLater(remote.modifiedTime, entry.remoteModified);
    const docState: DocSyncState = localChanged && remoteChanged ? 'both-changed' : localChanged ? 'local-newer' : remoteChanged ? 'remote-newer' : 'in-sync';
    rows.push({ key: doc.id, name: remote.name, state: docState, modified: remoteChanged ? remote.modifiedTime : doc.lastModified });
  }

  for (const file of remoteFiles) {
    if (matched.has(file.id)) continue;
    rows.push({ key: `remote:${file.id}`, name: file.name, state: 'remote-only', modified: file.modifiedTime });
  }

  const remoteProject = snapshot.remoteProjectFile;
  if (remoteProject) {
    const remoteChanged = isLater(remoteProject.modifiedTime, state.projectRemoteModified);
    const localChanged = isLater(lastLocalChangeOf(project), state.projectLocalModified);
    const projectState: DocSyncState = localChanged && remoteChanged ? 'both-changed' : localChanged ? 'local-newer' : remoteChanged ? 'remote-newer' : 'in-sync';
    rows.push({ key: 'project.json', name: 'project.json', state: projectState, modified: remoteProject.modifiedTime });
  } else {
    rows.push({ key: 'project.json', name: 'project.json', state: 'local-only', modified: lastLocalChangeOf(project) });
  }

  return rows;
}

/** `"2 uploaded, 1 downloaded"` — only the non-zero counters, or `"nothing to do"`. */
export function summaryLine(summary: SyncSummary): string {
  const parts: string[] = [];
  if (summary.uploaded) parts.push(`${summary.uploaded} uploaded`);
  if (summary.downloaded) parts.push(`${summary.downloaded} downloaded`);
  if (summary.conflicts) parts.push(`${summary.conflicts} conflict${summary.conflicts === 1 ? '' : 's'}`);
  if (summary.deleted) parts.push(`${summary.deleted} deleted`);
  return parts.length ? parts.join(', ') : 'nothing to do';
}

/**
 * `"4 min ago"` style. Returns `null` for a missing or unparseable timestamp so callers render
 * nothing rather than a fake time.
 */
export function relativeTime(iso: string | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

/** Opens a cloud URL: the system browser on desktop, a new tab on the web. */
export function openCloudUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (window.desktop?.openExternal) {
    void window.desktop.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
