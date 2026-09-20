import React from 'react';
import { Cloud, Database, Info, Settings, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../ui/Modal';
import { AboutPanel } from './AboutPanel';
import { AiProvidersPanel } from './AiProvidersPanel';
import { DataPanel } from './DataPanel';
import { BTN_SECONDARY, PanelHeading } from './controls';

type TabId = 'ai' | 'cloud' | 'data' | 'about';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'AI providers', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'cloud', label: 'Cloud sync', icon: <Cloud className="w-3.5 h-3.5" /> },
  { id: 'data', label: 'Data', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'about', label: 'About', icon: <Info className="w-3.5 h-3.5" /> },
];

/** Cloud tab: the connection UI is not built yet, so this reports the link state and says so. */
const CloudTab: React.FC = () => {
  const { activeProject, cloudStatus, setIsCloudPanelOpen } = useApp();
  return (
    <div className="space-y-4">
      <PanelHeading title="Cloud sync" description="Google Drive and OneDrive sync is implemented in the service layer; its settings screen is not built yet." />
      <p className="text-xs text-fg-muted leading-relaxed">
        {activeProject?.cloud ? `This project is linked to ${activeProject.cloud.providerId}.` : 'This project is not linked to a cloud folder.'} Status:{' '}
        {cloudStatus.state}
        {cloudStatus.message ? ` (${cloudStatus.message})` : ''}.
      </p>
      <button type="button" onClick={() => setIsCloudPanelOpen(true)} className={BTN_SECONDARY}>
        Open the cloud panel
      </button>
    </div>
  );
};

/**
 * The app's settings dialog: a tab rail over the AI providers, cloud sync, data and about panels.
 * Bound to `isSettingsOpen` in the store.
 */
export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen } = useApp();
  const [tab, setTab] = React.useState<TabId>('ai');

  return (
    <Modal
      open={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title="Settings"
      size="4xl"
      icon={<Settings className="w-4 h-4 text-amber-500 shrink-0" />}
      className="h-[85vh] sm:h-[640px]"
      bodyClassName="flex flex-col sm:flex-row overflow-hidden"
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Settings sections"
        className="flex sm:flex-col gap-1 p-2 sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-line overflow-x-auto"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`settings-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              tab === t.id ? 'bg-elevated text-fg border border-line' : 'text-fg-muted hover:text-fg hover:bg-elevated border border-transparent'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
        tabIndex={0}
        className="flex-1 min-w-0 overflow-y-auto px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
      >
        {tab === 'ai' && <AiProvidersPanel />}
        {tab === 'cloud' && <CloudTab />}
        {tab === 'data' && <DataPanel />}
        {tab === 'about' && <AboutPanel />}
      </div>
    </Modal>
  );
};
