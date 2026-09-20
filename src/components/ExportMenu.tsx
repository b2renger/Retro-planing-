import React from 'react';
import { ChevronDown, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { createProvider, openCloudUrl, PROVIDER_LABELS } from '../hooks/cloudClient';
import type { CloudProviderId } from '../services/cloud/types';
import type { CloudSettings, Project, User } from '../types';

/** The export barrel, loaded on demand — it pulls in exceljs, which must stay out of the main chunk. */
type ExportModule = typeof import('../services/export');

/** What an entry reports back. `null` means "nothing to say" (e.g. the save dialog was cancelled). */
type Result = { tone: 'ok' | 'error'; text: string; href?: string } | null;

interface Entry {
  id: string;
  label: string;
  hint: string;
  run: (ex: ExportModule, project: Project, members: User[]) => Promise<Result>;
}

/** Hands bytes to the user; a cancelled desktop dialog is not an error. */
async function save(ex: ExportModule, name: string, data: Uint8Array | string, mime: string): Promise<Result> {
  const res = await ex.downloadBytes(name, data, mime);
  if (!res.saved) return null;
  return { tone: 'ok', text: res.path ? `Saved to ${res.path}` : `Downloaded ${name}` };
}

const LOCAL_ENTRIES: Entry[] = [
  {
    id: 'xlsx',
    label: 'Excel workbook (.xlsx)',
    hint: 'Tasks, phases, milestones, a Gantt grid and a summary sheet',
    run: async (ex, project, members) =>
      save(ex, ex.safeFilename(project.title, 'xlsx'), await ex.projectToXlsx(project, members), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  },
  {
    id: 'csv-tasks',
    label: 'CSV — tasks',
    hint: 'One row per task',
    run: async (ex, project, members) => save(ex, ex.safeFilename(`${project.title} tasks`, 'csv'), ex.tasksToCsv(project, members), 'text/csv'),
  },
  {
    id: 'csv-phases',
    label: 'CSV — phases',
    hint: 'One row per phase',
    run: async (ex, project) => save(ex, ex.safeFilename(`${project.title} phases`, 'csv'), ex.phasesToCsv(project), 'text/csv'),
  },
  {
    id: 'csv-milestones',
    label: 'CSV — milestones',
    hint: 'One row per milestone',
    run: async (ex, project) => save(ex, ex.safeFilename(`${project.title} milestones`, 'csv'), ex.milestonesToCsv(project), 'text/csv'),
  },
  {
    id: 'markdown',
    label: 'Markdown',
    hint: 'The plan as a readable document',
    run: async (ex, project, members) => save(ex, ex.safeFilename(project.title, 'md'), ex.projectToMarkdown(project, members), 'text/markdown'),
  },
  {
    id: 'mermaid',
    label: 'Mermaid Gantt',
    hint: 'A ```mermaid gantt block to paste into docs',
    run: async (ex, project) => save(ex, ex.safeFilename(`${project.title} gantt`, 'mmd'), ex.projectToMermaidGantt(project), 'text/plain'),
  },
  {
    id: 'svg',
    label: 'Timeline SVG',
    hint: 'Vector timeline, scales to any size',
    run: async (ex, project) => save(ex, ex.safeFilename(`${project.title} timeline`, 'svg'), ex.ganttToSvg(project), 'image/svg+xml'),
  },
  {
    id: 'png',
    label: 'Timeline PNG',
    hint: 'Same timeline, rasterised at 2×',
    run: async (ex, project) => {
      const blob = await ex.svgToPngBlob(ex.ganttToSvg(project));
      return save(ex, ex.safeFilename(`${project.title} timeline`, 'png'), new Uint8Array(await blob.arrayBuffer()), 'image/png');
    },
  },
  {
    id: 'json',
    label: 'Project JSON',
    hint: 'The whole project — re-importable from the empty state',
    run: async (ex, project) => save(ex, ex.safeFilename(project.title, 'json'), ex.projectToJson(project), 'application/json'),
  },
];

/**
 * A cloud export is only possible when the project is linked to a folder of *that* provider,
 * because the workbook is uploaded into that folder's `exports/`. Anything else is explained
 * rather than attempted.
 */
function cloudEntry(providerId: CloudProviderId, cloudSettings: CloudSettings): Entry {
  const label = providerId === 'google' ? 'Send to Google Sheets' : 'Send to OneDrive (Excel)';
  return {
    id: `cloud-${providerId}`,
    label,
    hint: `Uploads the workbook into the project’s exports/ folder on ${PROVIDER_LABELS[providerId]}`,
    run: async (ex, project, members) => {
      const link = project.cloud;
      if (!link) {
        return { tone: 'error', text: 'This project is not linked to a cloud folder yet. Open the cloud panel and create or link a folder first — the export needs somewhere to go.' };
      }
      if (link.providerId !== providerId) {
        return { tone: 'error', text: `This project is linked to ${PROVIDER_LABELS[link.providerId]}, not ${PROVIDER_LABELS[providerId]}. The export goes into the linked folder only.` };
      }
      if (!link.exportsFolderId) {
        return { tone: 'error', text: 'The linked folder has no exports/ subfolder recorded yet. Run a sync from the cloud panel, then try again.' };
      }
      const provider = createProvider(cloudSettings, providerId);
      const res = providerId === 'google'
        ? await ex.exportToGoogleSheets(provider, link.exportsFolderId, project, members)
        : await ex.exportToOneDriveExcel(provider, link.exportsFolderId, project, members);
      return { tone: 'ok', text: `Uploaded ${res.name}`, href: res.webUrl };
    },
  };
}

/** Dropdown of every export. The export module is imported dynamically on first use. */
export const ExportMenu: React.FC<{ project: Project }> = ({ project }) => {
  const { teamMembers, cloudAccounts, cloudSettings } = useApp();
  const [open, setOpen] = React.useState(false);
  const [moduleLoading, setModuleLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result>(null);
  const modRef = React.useRef<ExportModule | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const loadModule = React.useCallback(async (): Promise<ExportModule> => {
    if (modRef.current) return modRef.current;
    setModuleLoading(true);
    try {
      const mod = await import('../services/export');
      modRef.current = mod;
      return mod;
    } finally {
      setModuleLoading(false);
    }
  }, []);

  // Close on outside click and on Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Warm the chunk as soon as the menu is opened, so the first click does not wait for the network.
  React.useEffect(() => {
    if (open && !modRef.current) void loadModule().catch(() => undefined);
  }, [open, loadModule]);

  const entries = React.useMemo(() => {
    const list = [...LOCAL_ENTRIES];
    for (const id of ['google', 'onedrive'] as CloudProviderId[]) {
      if (cloudAccounts[id]) list.push(cloudEntry(id, cloudSettings));
    }
    return list;
  }, [cloudAccounts, cloudSettings]);

  const run = async (entry: Entry) => {
    setBusy(entry.id);
    setResult(null);
    try {
      const ex = await loadModule();
      setResult(await entry.run(ex, project, teamMembers));
    } catch (err) {
      setResult({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        id="header-export-btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Export this project"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Export this project"
          className="absolute top-full right-0 mt-1.5 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm bg-card border border-line rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn"
        >
          {moduleLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-fg-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Loading the export module…</span>
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                onClick={() => void run(entry)}
                disabled={busy !== null}
                className="w-full flex items-start justify-between gap-2 px-3 py-2 rounded-xl text-left transition-colors text-fg hover:bg-elevated disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold truncate">{entry.label}</span>
                  <span className="block text-[10px] text-fg-muted">{entry.hint}</span>
                </span>
                {busy === entry.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-fg-muted shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>

          {result && (
            <div
              role="status"
              className={`mt-1.5 mx-1 mb-1 px-2.5 py-2 rounded-lg border text-[11px] leading-relaxed ${
                result.tone === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
              }`}
            >
              <span className="break-words">{result.text}</span>
              {result.href && (
                <button
                  type="button"
                  onClick={() => openCloudUrl(result.href!)}
                  className="mt-1 flex items-center gap-1 font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open it</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
