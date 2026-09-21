import React from 'react';
import { AlertTriangle, FolderPlus, Link2, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  bootstrapExistingFolder,
  bootstrapProjectFolder,
  initialSyncState,
  listCloudProjects,
  type CloudProjectRef,
  type ProjectFolderIds,
} from '../../services/cloud/syncEngine';
import type { CloudProviderId } from '../../services/cloud/types';
import { createProvider, linkFromSyncState, PROVIDER_LABELS } from '../../hooks/cloudClient';
import { relativeTime } from '../../utils/time';
import { runProjectSync } from '../../hooks/useCloudSync';
import { BTN_PRIMARY, BTN_SECONDARY } from '../settings/controls';
import type { Project } from '../../types';

interface Props {
  project: Project;
  /** Providers with a connected account; the first one is preselected. */
  connected: CloudProviderId[];
  onError: (message: string | null) => void;
}

type Mode = 'choose' | 'existing';

interface RemoteRow extends CloudProjectRef {
  modifiedTime?: string;
}

/**
 * The "connected but this project is not linked yet" state: create a fresh folder, or adopt a
 * project folder that already exists in the drive.
 */
export const CloudLinkSetup: React.FC<Props> = ({ project, connected, onError }) => {
  const { cloudSettings, setCloudLink, applyCloudPatch, setCloudStatus, addNotification } = useApp();
  const [providerId, setProviderId] = React.useState<CloudProviderId>(connected[0]);
  const [mode, setMode] = React.useState<Mode>('choose');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<RemoteRow[] | null>(null);

  const deps = { cloudSettings, applyCloudPatch, setCloudLink, setCloudStatus, addNotification };

  const link = async (ids: ProjectFolderIds) => {
    const state = initialSyncState(providerId, ids);
    const projectLink = linkFromSyncState(state);
    setCloudLink(project.id, projectLink);
    // The store update lands in the next render; sync against the link we just built.
    await runProjectSync({ ...project, cloud: projectLink }, deps);
  };

  const createFolder = async () => {
    onError(null);
    setBusy('create');
    try {
      const provider = createProvider(cloudSettings, providerId);
      await link(await bootstrapProjectFolder(provider, project.title));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const loadExisting = async () => {
    onError(null);
    setMode('existing');
    setBusy('list');
    setRows(null);
    try {
      const provider = createProvider(cloudSettings, providerId);
      const refs = await listCloudProjects(provider);
      const enriched = await Promise.all(
        refs.map(async (ref): Promise<RemoteRow> => {
          try {
            return { ...ref, modifiedTime: (await provider.getFile(ref.projectFileId)).modifiedTime };
          } catch {
            return ref; // the listing is still useful without a timestamp
          }
        })
      );
      setRows(enriched);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setBusy(null);
    }
  };

  const adopt = async (ref: CloudProjectRef) => {
    onError(null);
    setBusy(ref.folderId);
    try {
      const provider = createProvider(cloudSettings, providerId);
      await link(await bootstrapExistingFolder(provider, ref.folderId));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {connected.length > 1 && (
        <div role="radiogroup" aria-label="Cloud provider" className="flex items-center gap-1.5">
          {connected.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={providerId === id}
              onClick={() => {
                setProviderId(id);
                setMode('choose');
                setRows(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                providerId === id ? 'bg-elevated border-line-strong text-fg' : 'border-line text-fg-muted hover:text-fg hover:bg-elevated'
              }`}
            >
              {PROVIDER_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-line bg-elevated p-4 space-y-2">
        <h3 className="text-sm font-bold text-fg flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Create a folder for this project
        </h3>
        <p className="text-xs text-fg-muted leading-relaxed">
          Creates <span className="font-mono">RetroPlaningStudio/{project.title}</span> in {PROVIDER_LABELS[providerId]}, with <span className="font-mono">docs/</span> and{' '}
          <span className="font-mono">exports/</span> inside it, then uploads this project as it is now.
        </p>
        <button type="button" onClick={createFolder} className={BTN_PRIMARY} disabled={busy !== null}>
          {busy === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
          <span>{busy === 'create' ? 'Creating and uploading…' : 'Create folder and upload'}</span>
        </button>
      </div>

      <div className="rounded-xl border border-line bg-elevated p-4 space-y-3">
        <h3 className="text-sm font-bold text-fg flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          Link an existing cloud project
        </h3>
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-2 leading-relaxed flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            On the first sync the cloud copy wins: the folder’s <span className="font-mono">project.json</span> and every document in it replace what is on this
            device. That is how the engine behaves — link an existing folder only when the cloud copy is the one you want to keep.
          </span>
        </p>
        <button type="button" onClick={loadExisting} className={BTN_SECONDARY} disabled={busy !== null}>
          {busy === 'list' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{busy === 'list' ? 'Looking…' : rows ? 'Refresh the list' : 'List cloud projects'}</span>
        </button>

        {mode === 'existing' && rows !== null && (
          <ul className="space-y-1.5">
            {rows.length === 0 && (
              <li className="text-xs text-fg-muted">
                No folder under <span className="font-mono">RetroPlaningStudio/</span> contains a <span className="font-mono">project.json</span>.
              </li>
            )}
            {rows.map((ref) => {
              const ago = relativeTime(ref.modifiedTime);
              return (
                <li key={ref.folderId}>
                  <button
                    type="button"
                    onClick={() => adopt(ref)}
                    disabled={busy !== null}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-card border border-line hover:border-line-strong text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-fg truncate">{ref.name}</span>
                      <span className="block text-[11px] text-fg-muted">{ago ? `project.json last changed ${ago}` : 'change time unavailable'}</span>
                    </span>
                    {busy === ref.folderId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-fg-muted shrink-0" />
                    ) : (
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 shrink-0">Link</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
