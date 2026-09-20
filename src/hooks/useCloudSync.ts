/**
 * Background sync for the active project: on mount, on window focus and on a timer, with a
 * single-flight guard, a back-off after repeated failures and a pause while the device is offline.
 *
 * `runProjectSync` is the one place a sync is actually executed — the cloud panel's "Sync now"
 * button calls it too, so manual and background runs behave identically.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { executeSync, fetchRemoteSnapshot, planSync, type SyncAction, type SyncSummary } from '../services/cloud/syncEngine';
import { isCloudError } from '../services/cloud/types';
import type { CloudSettings, MarkdownDoc, Notification, Project, ProjectCloudLink } from '../types';
import { createProvider, lastLocalChangeOf, linkFromSyncState, PROVIDER_LABELS, summaryLine } from './cloudClient';

/** Poll interval while things are healthy. */
export const SYNC_INTERVAL_MS = 60_000;
/** Poll interval after `FAILURES_BEFORE_BACKOFF` consecutive failures. */
export const SYNC_BACKOFF_MS = 5 * 60_000;
/** Consecutive failures that trigger the back-off. */
export const FAILURES_BEFORE_BACKOFF = 2;

/** The store writers a sync run needs. Passed in so the runner itself stays testable. */
export interface SyncDeps {
  cloudSettings: CloudSettings;
  applyCloudPatch: (projectId: string, patch: { documents?: MarkdownDoc[]; projectPatch?: Partial<Project> }) => void;
  setCloudLink: (projectId: string, link: ProjectCloudLink | null) => void;
  setCloudStatus: (status: { state: 'idle' | 'syncing' | 'ok' | 'error'; message?: string; lastSyncAt?: string }) => void;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

/** Knobs the two callers differ on. */
export interface SyncRunOptions {
  /** Document currently open in the editor: downloads that would replace it are deferred. */
  protectDocId?: string;
  /** Push a notification when the whole run fails. The background loop only does this once per streak. */
  notifyErrors?: boolean;
}

/** What the caller renders after a run. Never claims more than actually happened. */
export interface SyncOutcome {
  ok: boolean;
  /** Present when the plan ran, even if some actions inside it failed. */
  summary?: SyncSummary;
  /** Per-action failures collected by the executor. */
  errors: Array<{ action: string; message: string }>;
  /** Warnings the engine emitted — conflicts name the document and the copy that was kept. */
  warnings: string[];
  /** Downloads deferred because the document is open in the editor. */
  deferred: string[];
  /** Fatal error (auth, network, no link) — the run produced no summary. */
  error?: string;
  /** True when the token is gone or unrefreshable: the UI must offer Connect again. */
  needsReconnect?: boolean;
  lastSyncAt?: string;
}

function describeAction(action: SyncAction): string {
  if ('name' in action && action.name) return `${action.type} ${action.name}`;
  if ('docId' in action && action.docId) return `${action.type} ${action.docId}`;
  return action.type;
}

/**
 * Snapshot → plan → execute for one project, writing the results back through `deps`.
 * Resolves (never rejects) with an outcome describing exactly what happened.
 */
export async function runProjectSync(project: Project, deps: SyncDeps, opts: SyncRunOptions = {}): Promise<SyncOutcome> {
  const link = project.cloud;
  if (!link) return { ok: false, errors: [], warnings: [], deferred: [], error: 'This project is not linked to a cloud folder.' };

  const warnings: string[] = [];
  const hardErrors: string[] = [];
  deps.setCloudStatus({ state: 'syncing', lastSyncAt: link.lastSyncAt });

  try {
    const provider = createProvider(deps.cloudSettings, link.providerId);
    const snapshot = await fetchRemoteSnapshot(provider, link.syncState);
    const plan = planSync(project, snapshot.remoteDocs, snapshot.remoteProjectFile, link.syncState, { lastLocalChange: lastLocalChangeOf(project) });

    const deferred: string[] = [];
    const runnable = plan.filter((action) => {
      if (!opts.protectDocId) return true;
      const replacesOpenDoc =
        (action.type === 'download-doc' && action.docId === opts.protectDocId) ||
        (action.type === 'conflict' && action.docId === opts.protectDocId) ||
        (action.type === 'delete-local-doc' && action.docId === opts.protectDocId);
      if (replacesOpenDoc) deferred.push('name' in action && action.name ? action.name : opts.protectDocId);
      return !replacesOpenDoc;
    });

    const result = await executeSync(provider, project, link.syncState, runnable, {
      applyLocalChanges: (patch) => {
        deps.applyCloudPatch(project.id, { documents: patch.documents, projectPatch: patch.project });
      },
      notify: (message, level) => {
        if (level === 'warning') warnings.push(message);
        if (level === 'error') hardErrors.push(message);
      },
    });

    deps.setCloudLink(project.id, linkFromSyncState(result.state));

    const errors = result.errors.map((e) => ({ action: describeAction(e.action), message: e.message }));
    const ok = errors.length === 0;
    const parts = [summaryLine(result.summary)];
    if (deferred.length) parts.push(`${deferred.length} deferred while you are editing`);
    if (errors.length) parts.push(`${errors.length} action${errors.length === 1 ? '' : 's'} failed`);
    deps.setCloudStatus({ state: ok ? 'ok' : 'error', message: parts.join(' · '), lastSyncAt: result.state.lastSyncAt });

    for (const warning of warnings) {
      deps.addNotification({ title: 'Cloud sync conflict', message: warning, type: 'status_update', projectId: project.id });
    }
    if (!ok && opts.notifyErrors !== false) {
      deps.addNotification({
        title: `${PROVIDER_LABELS[link.providerId]} sync had errors`,
        message: errors.map((e) => `${e.action}: ${e.message}`).join(' — '),
        type: 'status_update',
        projectId: project.id,
      });
    }

    return { ok, summary: result.summary, errors, warnings, deferred, lastSyncAt: result.state.lastSyncAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsReconnect = isCloudError(err) && err.kind === 'auth';
    deps.setCloudStatus({ state: 'error', message, lastSyncAt: link.lastSyncAt });
    if (opts.notifyErrors !== false) {
      deps.addNotification({
        title: needsReconnect ? `${PROVIDER_LABELS[link.providerId]} needs reconnecting` : `${PROVIDER_LABELS[link.providerId]} sync failed`,
        message,
        type: 'status_update',
        projectId: project.id,
      });
    }
    return { ok: false, errors: hardErrors.map((m) => ({ action: 'sync', message: m })), warnings, deferred: [], error: message, needsReconnect };
  }
}

/**
 * Mount once (in `App`). Syncs the active project on mount, on window focus, when the device
 * comes back online and every minute — five minutes after two consecutive failures. Runs never
 * overlap, and a download that would replace the document open in the Markdown editor is deferred
 * to the next run (the facade exposes no per-document dirty flag).
 */
export function useCloudSync(): void {
  const app = useApp();
  const appRef = useRef(app);
  appRef.current = app;

  const running = useRef(false);
  const failures = useRef(0);
  const timer = useRef<number | null>(null);

  const tick = useCallback(async () => {
    const a = appRef.current;
    const project = a.activeProject;
    if (!project?.cloud || running.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      a.setCloudStatus({ state: 'idle', message: 'Offline — sync paused.', lastSyncAt: project.cloud.lastSyncAt });
      return;
    }
    running.current = true;
    try {
      const outcome = await runProjectSync(
        project,
        {
          cloudSettings: a.cloudSettings,
          applyCloudPatch: a.applyCloudPatch,
          setCloudLink: a.setCloudLink,
          setCloudStatus: a.setCloudStatus,
          addNotification: a.addNotification,
        },
        {
          protectDocId: a.activeViewTab === 'markdown' ? a.activeDocument?.id : undefined,
          // Only the first failure of a streak raises a notification; the chip keeps the state.
          notifyErrors: failures.current === 0,
        }
      );
      failures.current = outcome.ok ? 0 : failures.current + 1;
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const schedule = () => {
      const delay = failures.current >= FAILURES_BEFORE_BACKOFF ? SYNC_BACKOFF_MS : SYNC_INTERVAL_MS;
      timer.current = window.setTimeout(async () => {
        if (cancelled) return;
        await tick();
        if (!cancelled) schedule();
      }, delay);
    };

    const onWake = () => void tick();

    void tick();
    schedule();
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);

    return () => {
      cancelled = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [tick]);
}
