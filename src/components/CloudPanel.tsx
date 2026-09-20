import React from 'react';
import { X, HardDrive } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Placeholder. The real cloud panel (Google Drive / OneDrive connection, folder link, sync) is
 * implemented separately against `cloudSettings`, `cloudAccounts`, `cloudStatus` and the
 * project-level `cloud` link in `useApp()`.
 */
export const CloudPanel: React.FC = () => {
  const { isCloudPanelOpen, setIsCloudPanelOpen, activeProject, cloudStatus } = useApp();
  if (!isCloudPanelOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold">Cloud sync</h2>
          </div>
          <button onClick={() => setIsCloudPanelOpen(false)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm">
          <p>Cloud sync will be configured here.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeProject?.cloud ? `This project is linked to ${activeProject.cloud.providerId}.` : 'This project is not linked to a cloud folder.'}{' '}
            Status: {cloudStatus.state}
            {cloudStatus.message ? ` (${cloudStatus.message})` : ''}.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
          <button onClick={() => setIsCloudPanelOpen(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
