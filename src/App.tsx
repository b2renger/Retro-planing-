import React from 'react';
import { FolderPlus } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { ProjectHeader } from './components/ProjectHeader';
import { ImmediateActionView } from './components/ImmediateActionView';
import { RetroplanningTimeline } from './components/RetroplanningTimeline';
import { MarkdownStudio } from './components/MarkdownStudio';
import { TaskBoard } from './components/TaskBoard';
import { HardwareMediaView } from './components/HardwareMediaView';
import { HistoryAuditView } from './components/HistoryAuditView';
import { TeamCollaborationView } from './components/TeamCollaborationView';
import { GeminiAssistantModal } from './components/GeminiAssistantModal';
import { CloudPanel } from './components/CloudPanel';
import { CreateTaskModal } from './components/CreateTaskModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { TutorialDrawer } from './components/TutorialDrawer';
import { InviteCollaboratorsModal } from './components/InviteCollaboratorsModal';

const EmptyState: React.FC = () => {
  const { setIsCreateProjectModalOpen, importProjectFromJson } = useApp();
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = importProjectFromJson(await file.text());
    setError(res.ok ? null : res.error ?? 'Import failed');
    e.target.value = '';
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-4">
        <FolderPlus className="w-10 h-10 mx-auto text-fg-muted" />
        <h1 className="text-lg font-semibold">No project yet</h1>
        <p className="text-sm text-fg-muted">Create a project or import one from a JSON export. Everything is stored on this device.</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setIsCreateProjectModalOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
            Create project
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg border border-line-strong text-sm font-semibold">
            Import JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { activeViewTab, activeProject, storageError } = useApp();

  return (
    <div className="min-h-screen bg-app text-fg flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-200 transition-colors duration-200">
      <Navbar />

      {storageError && (
        <div role="alert" className="bg-rose-600 text-white text-xs px-4 py-2 text-center">
          {storageError}
        </div>
      )}

      {activeProject ? (
        <>
          <ProjectHeader />
          <main className="flex-1 pb-16">
            {activeViewTab === 'immediate' && <ImmediateActionView />}
            {activeViewTab === 'retroplanning' && <RetroplanningTimeline />}
            {activeViewTab === 'hardware' && <HardwareMediaView />}
            {activeViewTab === 'markdown' && <MarkdownStudio />}
            {activeViewTab === 'tasks' && <TaskBoard />}
            {activeViewTab === 'history' && <HistoryAuditView />}
            {activeViewTab === 'collaboration' && <TeamCollaborationView />}
          </main>
          <GeminiAssistantModal />
          <CloudPanel />
          <CreateTaskModal />
          <TutorialDrawer />
          <InviteCollaboratorsModal />
        </>
      ) : (
        <EmptyState />
      )}

      <CreateProjectModal />
      <ApiSettingsModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
