import React from 'react';
import { AlertTriangle, ExternalLink, FolderOpen, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchRemoteSnapshot, type RemoteSnapshot } from '../../services/cloud/syncEngine';
import {
  compareDocuments,
  createProvider,
  DOC_STATE_LABELS,
  openCloudUrl,
  PROVIDER_LABELS,
  summaryLine,
  type DocStatusRow,
  type DocSyncState,
} from '../../hooks/cloudClient';
import { runProjectSync, type SyncOutcome } from '../../hooks/useCloudSync';
import { relativeTime } from '../../utils/time';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '../settings/controls';
import type { Project } from '../../types';

/** Accent per file state. Surfaces only — text colours follow the theme rule. */
const STATE_CLASS: Record<DocSyncState, string> = {
  'in-sync': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'local-newer': 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'remote-newer': 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'both-changed': 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'local-only': 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'remote-only': 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'remote-deleted': 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

interface Props {
  project: Project;
  onError: (message: string | null) => void;
}

/** Linked state: folder, last sync, Sync now, the per-file comparison, and Unlink. */
export const CloudLinkedView: React.FC<Props> = ({ project, onError }) => {
  const { cloudSettings, setCloudLink, applyCloudPatch, setCloudStatus, addNotification, cloudStatus, activeViewTab, activeDocument } = useApp();
  const link = project.cloud!;
  const [folder, setFolder] = React.useState<{ name: string; webUrl?: string } | null>(null);
  const [rows, setRows] = React.useState<DocStatusRow[] | null>(null);
  const [loadingFiles, setLoadingFiles] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [outcome, setOutcome] = React.useState<SyncOutcome | null>(null);
  const [confirmUnlink, setConfirmUnlink] = React.useState(false);

  const projectRef = React.useRef(project);
  projectRef.current = project;

  const refresh = React.useCallback(async () => {
    setLoadingFiles(true);
    try {
      const provider = createProvider(cloudSettings, link.providerId);
      const [meta, snapshot] = await Promise.all([
        provider.getFile(link.folderId).then((f) => ({ name: f.name, webUrl: f.webUrl })),
        fetchRemoteSnapshot(provider, link.syncState) as Promise<RemoteSnapshot>,
      ]);
      setFolder(meta);
      setRows(compareDocuments(projectRef.current, snapshot, link.syncState));
      onError(null);
    } catch (err) {
      setRows(null);
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFiles(false);
    }
    // The project is read through a ref so an unrelated edit does not re-list the folder; the
    // effect below re-runs whenever the sync state changes, which is when the listing can differ.
  }, [cloudSettings, link.providerId, link.folderId, link.syncState, onError]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const syncNow = async () => {
    setSyncing(true);
    onError(null);
    try {
      const result = await runProjectSync(
        project,
        { cloudSettings, applyCloudPatch, setCloudLink, setCloudStatus, addNotification },
        { protectDocId: activeViewTab === 'markdown' ? activeDocument?.id : undefined }
      );
      setOutcome(result);
      if (result.error) onError(result.error);
      // The new sync state re-runs the effect below, which re-lists the folder against the
      // project the store now holds — re-listing here would read the pre-sync project.
    } finally {
      setSyncing(false);
    }
  };

  const unlink = () => {
    setCloudLink(project.id, null);
    setCloudStatus({ state: 'idle' });
    setConfirmUnlink(false);
  };

  const lastSync = relativeTime(link.lastSyncAt);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-elevated p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2 min-w-0">
              <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">{folder?.name ?? link.syncState.projectFolderId}</span>
            </h3>
            <p className="text-xs text-fg-muted mt-1">
              {PROVIDER_LABELS[link.providerId]} · {lastSync ? `last synced ${lastSync}` : 'never synced yet'}
              {cloudStatus.state === 'error' && cloudStatus.message ? ` · ${cloudStatus.message}` : ''}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {folder?.webUrl && (
              <button type="button" onClick={() => openCloudUrl(folder.webUrl!)} className={BTN_SECONDARY}>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open folder</span>
              </button>
            )}
            <button type="button" onClick={syncNow} className={BTN_PRIMARY} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{syncing ? 'Syncing…' : 'Sync now'}</span>
            </button>
          </div>
        </div>
      </div>

      {outcome && (
        <div className="rounded-xl border border-line bg-elevated p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Last run</h4>
          {outcome.summary ? (
            <p className="text-xs text-fg">
              {summaryLine(outcome.summary)}
              {outcome.deferred.length > 0 && (
                <span className="text-fg-muted">
                  {' '}
                  · {outcome.deferred.length} download{outcome.deferred.length === 1 ? '' : 's'} deferred because the document is open in the editor (
                  {outcome.deferred.join(', ')})
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-rose-700 dark:text-rose-300">{outcome.error ?? 'The run produced no result.'}</p>
          )}
          {outcome.warnings.map((w) => (
            <p key={w} className="text-[11px] text-amber-700 dark:text-amber-300 flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{w}</span>
            </p>
          ))}
          {outcome.errors.map((e) => (
            <p key={`${e.action}:${e.message}`} className="text-[11px] text-rose-700 dark:text-rose-300">
              <span className="font-mono">{e.action}</span> — {e.message}
            </p>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-line bg-elevated p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Files in the cloud folder</h4>
          <button type="button" onClick={() => void refresh()} className={BTN_SECONDARY} disabled={loadingFiles}>
            {loadingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Refresh</span>
          </button>
        </div>
        {loadingFiles && rows === null && <p className="text-xs text-fg-muted">Reading the folder…</p>}
        {!loadingFiles && rows === null && <p className="text-xs text-fg-muted">The folder could not be read — see the message above.</p>}
        {rows !== null && rows.length === 0 && <p className="text-xs text-fg-muted">Nothing to compare yet.</p>}
        {rows !== null && rows.length > 0 && (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const ago = relativeTime(row.modified);
              return (
                <li key={row.key} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-xs text-fg font-mono truncate">{row.name}</span>
                    {ago && <span className="block text-[11px] text-fg-muted">changed {ago}</span>}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATE_CLASS[row.state]}`}>{DOC_STATE_LABELS[row.state]}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-elevated p-4 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-fg-muted">Unlink</h4>
        <p className="text-xs text-fg-muted leading-relaxed">
          Unlinking stops syncing this project. Every file stays in {PROVIDER_LABELS[link.providerId]} exactly as it is now, and the local copy stays here — the two
          simply stop following each other.
        </p>
        {confirmUnlink ? (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={unlink} className={BTN_DANGER}>
              <Unlink className="w-3.5 h-3.5" />
              <span>Confirm unlink</span>
            </button>
            <button type="button" onClick={() => setConfirmUnlink(false)} className={BTN_SECONDARY}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmUnlink(true)} className={BTN_SECONDARY}>
            <Unlink className="w-3.5 h-3.5" />
            <span>Unlink this project</span>
          </button>
        )}
      </div>
    </div>
  );
};
