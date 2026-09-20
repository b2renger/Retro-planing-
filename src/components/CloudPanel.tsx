import React from 'react';
import { AlertTriangle, HardDrive, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './ui/Modal';
import { CloudLinkSetup } from './cloud/CloudLinkSetup';
import { CloudLinkedView } from './cloud/CloudLinkedView';
import { PROVIDER_LABELS } from '../hooks/cloudClient';
import { BTN_PRIMARY, BTN_SECONDARY } from './settings/controls';
import { requestSettingsTab } from './settings/settingsTabs';
import type { CloudProviderId } from '../services/cloud/types';

const ALL_PROVIDERS: CloudProviderId[] = ['google', 'onedrive'];

/**
 * The project's cloud panel. Three honest states: no account connected, connected but this
 * project is not linked to a folder, and linked. Nothing here claims a connection or a sync that
 * has not actually happened — every claim comes from the store or from a live provider call.
 */
export const CloudPanel: React.FC = () => {
  const { isCloudPanelOpen, setIsCloudPanelOpen, setIsSettingsOpen, activeProject, cloudAccounts } = useApp();
  const [error, setError] = React.useState<string | null>(null);

  const close = () => setIsCloudPanelOpen(false);
  const openSettings = () => {
    setIsCloudPanelOpen(false);
    setIsSettingsOpen(true);
    requestSettingsTab('cloud');
  };

  const connected = ALL_PROVIDERS.filter((id) => cloudAccounts[id]);
  const link = activeProject?.cloud ?? null;
  const linkedProviderConnected = link ? Boolean(cloudAccounts[link.providerId]) : false;

  return (
    <Modal
      open={isCloudPanelOpen}
      onClose={close}
      title="Cloud sync"
      subtitle={activeProject?.title}
      size="2xl"
      icon={<HardDrive className="w-4 h-4 text-blue-500 shrink-0" />}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={openSettings} className={BTN_SECONDARY}>
            <Settings className="w-3.5 h-3.5" />
            <span>Cloud settings</span>
          </button>
          <button type="button" onClick={close} className={BTN_SECONDARY}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-2 leading-relaxed">
            {error}
          </p>
        )}

        {!activeProject && <p className="text-sm text-fg-muted">Open a project first.</p>}

        {activeProject && connected.length === 0 && (
          <div className="rounded-xl border border-line bg-elevated p-4 space-y-3">
            <h3 className="text-sm font-bold text-fg">No cloud account is connected</h3>
            <p className="text-xs text-fg-muted leading-relaxed">
              Link this project to a folder in your own Google Drive or OneDrive and that folder becomes the source of truth for it: documents and{' '}
              <span className="font-mono">project.json</span> live there, and every device you open the project on follows the folder.
            </p>
            <button type="button" onClick={openSettings} className={BTN_PRIMARY}>
              <Settings className="w-3.5 h-3.5" />
              <span>Connect an account in Settings → Cloud sync</span>
            </button>
          </div>
        )}

        {activeProject && link && !linkedProviderConnected && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {PROVIDER_LABELS[link.providerId]} needs reconnecting
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              This project is still linked to its folder, but there is no signed-in {PROVIDER_LABELS[link.providerId]} account on this device, so nothing can
              sync. Connect the account again and syncing resumes where it left off.
            </p>
            <button type="button" onClick={openSettings} className={BTN_PRIMARY}>
              <Settings className="w-3.5 h-3.5" />
              <span>Reconnect</span>
            </button>
          </div>
        )}

        {activeProject && link && <CloudLinkedView project={activeProject} onError={setError} />}

        {activeProject && !link && connected.length > 0 && <CloudLinkSetup project={activeProject} connected={connected} onError={setError} />}
      </div>
    </Modal>
  );
};
