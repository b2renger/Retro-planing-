import React from 'react';
import { Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './ui/Modal';

/**
 * Placeholder settings panel. The real settings UI (AI providers with keys, cloud client ids,
 * backup/restore, storage diagnostics) is implemented separately against `aiSettings`,
 * `cloudSettings`, `exportBackup`/`importBackup` and `secretsBackend` in `useApp()`.
 */
export const ApiSettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, aiSettings, activeAiProvider, secretsBackend, secretsReady } = useApp();
  const close = () => setIsSettingsOpen(false);

  return (
    <Modal
      open={isSettingsOpen}
      onClose={close}
      title="Settings"
      size="md"
      icon={<Settings className="w-4 h-4 text-amber-500 shrink-0" />}
      footer={
        <div className="flex justify-end">
          <button
            onClick={close}
            className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-line-strong border border-line text-fg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-2 text-sm">
        <p>AI providers and cloud storage will be configured here.</p>
        <p className="text-xs text-fg-muted">
          {aiSettings.providers.length} AI provider(s) configured
          {activeAiProvider ? `; active: ${activeAiProvider.label} (${activeAiProvider.model})` : '; none active'}.
        </p>
        <p className="text-xs text-fg-muted">
          Secrets storage: {secretsBackend === 'secure-store' ? 'OS secure store' : secretsBackend === 'local-storage' ? 'browser localStorage (clear text)' : 'unavailable'}
          {secretsReady ? '' : ' (loading)'}.
        </p>
      </div>
    </Modal>
  );
};
