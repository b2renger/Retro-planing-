import React from 'react';
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
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { GoogleLoginModal } from './components/GoogleLoginModal';
import { ImplementationPlanModal } from './components/ImplementationPlanModal';
import { TutorialDrawer } from './components/TutorialDrawer';
import { DatabaseTesterModal } from './components/DatabaseTesterModal';
import { InviteCollaboratorsModal } from './components/InviteCollaboratorsModal';
import { InteractiveTourGuide } from './components/InteractiveTourGuide';

const AppContent: React.FC = () => {
  const { activeViewTab, isDatabaseTesterOpen, setIsDatabaseTesterOpen } = useApp();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070A10] text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-200 transition-colors duration-200">
      {/* Top Application Navbar */}
      <Navbar />

      {/* Project Command & Rétroplanning Header */}
      <ProjectHeader />

      {/* Main Dynamic View Content */}
      <main className="flex-1 pb-16">
        {activeViewTab === 'immediate' && <ImmediateActionView />}
        {activeViewTab === 'retroplanning' && <RetroplanningTimeline />}
        {activeViewTab === 'hardware' && <HardwareMediaView />}
        {activeViewTab === 'markdown' && <MarkdownStudio />}
        {activeViewTab === 'tasks' && <TaskBoard />}
        {activeViewTab === 'history' && <HistoryAuditView />}
        {activeViewTab === 'collaboration' && <TeamCollaborationView />}
      </main>

      {/* Modals, Drawers & Interactive Floating Tour Guide */}
      <GeminiAssistantModal />
      <GoogleDriveModal />
      <CreateTaskModal />
      <CreateProjectModal />
      <ApiSettingsModal />
      <GoogleLoginModal />
      <ImplementationPlanModal />
      <TutorialDrawer />
      <InteractiveTourGuide />
      <InviteCollaboratorsModal />
      <DatabaseTesterModal
        isOpen={isDatabaseTesterOpen}
        onClose={() => setIsDatabaseTesterOpen(false)}
      />
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
