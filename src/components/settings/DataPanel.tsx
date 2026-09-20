import React from 'react';
import { Download, HardDrive, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadBytes, safeFilename } from '../../services/export/download';
import { runStorageSelfTest, type StorageSelfTest } from '../../state/persistence';
import { BTN_SECONDARY, PanelHeading } from './controls';
import { formatBytes } from './helpers';

type Outcome = { ok: boolean; text: string } | null;

/** Backup, restore and storage diagnostics. Every message reports what actually happened. */
export const DataPanel: React.FC = () => {
  const { exportBackup, importBackup, storageError } = useApp();
  const [exportOutcome, setExportOutcome] = React.useState<Outcome>(null);
  const [importOutcome, setImportOutcome] = React.useState<Outcome>(null);
  const [selfTest, setSelfTest] = React.useState<StorageSelfTest | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setExportOutcome(null);
    try {
      const name = safeFilename(`retroplaningstudio-backup-${new Date().toISOString().slice(0, 10)}`, 'json');
      const res = await downloadBytes(name, exportBackup(), 'application/json');
      setExportOutcome(
        res.saved ? { ok: true, text: res.path ? `Saved to ${res.path}` : `Downloaded as ${name}` } : { ok: false, text: 'Save cancelled.' },
      );
    } catch (err) {
      setExportOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const res = importBackup(await file.text());
    setImportOutcome(res.ok ? { ok: true, text: `Restored from ${file.name}. Undo is available for this change.` } : { ok: false, text: res.error ?? 'Import failed.' });
  };

  const line = (outcome: Outcome) =>
    outcome && (
      <p role="status" className={`text-[11px] ${outcome.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {outcome.text}
      </p>
    );

  return (
    <div className="space-y-5">
      <PanelHeading
        title="Data"
        description="Everything is stored on this device. A backup is a plain JSON file of your projects, team and settings — API keys are never included."
      />

      <div className="p-3 rounded-xl bg-elevated border border-line space-y-2">
        <h4 className="text-xs font-bold text-fg">Backup</h4>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={doExport} className={BTN_SECONDARY}>
            <Download className="w-3.5 h-3.5" />
            <span>Export backup</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={BTN_SECONDARY}>
            <Upload className="w-3.5 h-3.5" />
            <span>Restore from backup</span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />
        </div>
        {line(exportOutcome)}
        {line(importOutcome)}
        <p className="text-[11px] text-fg-muted leading-relaxed">Restoring replaces the slices present in the file. It is undoable from the toolbar.</p>
      </div>

      <div className="p-3 rounded-xl bg-elevated border border-line space-y-2">
        <h4 className="text-xs font-bold text-fg">Local storage</h4>
        <button type="button" onClick={() => setSelfTest(runStorageSelfTest())} className={BTN_SECONDARY}>
          <HardDrive className="w-3.5 h-3.5" />
          <span>Check storage</span>
        </button>
        {selfTest && (
          <p role="status" className="text-[11px] text-fg-muted leading-relaxed">
            <span className={selfTest.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{selfTest.message}</span>{' '}
            {selfTest.keyCount} key(s), {formatBytes(selfTest.usedBytes)} used by this app.
          </p>
        )}
        {storageError && (
          <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">
            Last write failed: {storageError}
          </p>
        )}
      </div>
    </div>
  );
};
