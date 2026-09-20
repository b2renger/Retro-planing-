import React from 'react';
import { X, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Placeholder settings panel. The real settings UI (AI providers with keys, cloud client ids,
 * backup/restore, storage diagnostics) is implemented separately against `aiSettings`,
 * `cloudSettings`, `exportBackup`/`importBackup` and `secretsBackend` in `useApp()`.
 */
export const ApiSettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, aiSettings, activeAiProvider, secretsBackend, secretsReady } = useApp();
  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <button onClick={() => setIsSettingsOpen(false)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm">
          <p>AI providers and cloud storage will be configured here.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {aiSettings.providers.length} AI provider(s) configured
            {activeAiProvider ? `; active: ${activeAiProvider.label} (${activeAiProvider.model})` : '; none active'}.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Secrets storage: {secretsBackend === 'secure-store' ? 'OS secure store' : secretsBackend === 'local-storage' ? 'browser localStorage (clear text)' : 'unavailable'}
            {secretsReady ? '' : ' (loading)'}.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
          <button onClick={() => setIsSettingsOpen(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
