import React from 'react';
import { HardDrive } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './ui/Modal';

/**
 * Placeholder. The real cloud panel (Google Drive / OneDrive connection, folder link, sync) is
 * implemented separately against `cloudSettings`, `cloudAccounts`, `cloudStatus` and the
 * project-level `cloud` link in `useApp()`.
 */
export const CloudPanel: React.FC = () => {
  const { isCloudPanelOpen, setIsCloudPanelOpen, activeProject, cloudStatus } = useApp();
  const close = () => setIsCloudPanelOpen(false);

  return (
    <Modal
      open={isCloudPanelOpen}
      onClose={close}
      title="Cloud sync"
      size="md"
      icon={<HardDrive className="w-4 h-4 text-blue-500 shrink-0" />}
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
        <p>Cloud sync will be configured here.</p>
        <p className="text-xs text-fg-muted">
          {activeProject?.cloud ? `This project is linked to ${activeProject.cloud.providerId}.` : 'This project is not linked to a cloud folder.'}{' '}
          Status: {cloudStatus.state}
          {cloudStatus.message ? ` (${cloudStatus.message})` : ''}.
        </p>
      </div>
    </Modal>
  );
};
