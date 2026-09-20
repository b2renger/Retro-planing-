import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  Layers,
  Bell,
  HardDrive,
  ChevronDown,
  Plus,
  CheckCircle2,
  Key,
  GraduationCap,
  ClipboardList,
  Menu,
  X,
  Settings,
  User,
  Shield,
  ExternalLink,
  Database,
  UserPlus,
  Play,
  Sun,
  Moon,
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

export const Navbar: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    resolvedTheme,
    setTheme,
    teamMembers,
    activeAiProvider,
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    unreadCount,
    activeViewTab,
    setActiveViewTab,
    setIsCloudPanelOpen,
    setIsAiAssistantOpen,
    setIsCreateProjectModalOpen,
    setIsSettingsOpen,
    setIsTutorialDrawerOpen,
    setIsInviteModalOpen,
  } = useApp();

  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 sticky top-0 z-40 px-3 sm:px-4 py-2 w-full max-w-full transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 min-w-0">
        {/* Left: Brand & Workspace Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-purple-500/20 text-white font-bold text-xs sm:text-sm tracking-tight shrink-0">
              RP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
                <span className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight text-xs sm:text-sm truncate">
                  RetroPlan
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 shrink-0">
                  STUDIO
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5 sm:mt-1 truncate hidden xs:block">
                Design Ops & Rétroplanning
              </p>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />

          {/* Desktop Workspace Selector */}
          <div className="relative hidden md:block">
            <button
              id="workspace-switcher-btn"
              onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeWorkspace.color }}
              />
              <span className="text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{activeWorkspace.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {isWorkspaceDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl dark:shadow-2xl p-1.5 z-50 animate-fadeIn">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Workspaces
                </div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setIsWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      ws.id === activeWorkspace.id
                        ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                      <span className="truncate">{ws.name}</span>
                    </div>
                    {ws.id === activeWorkspace.id && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 ml-2" />}
                  </button>
                ))}
                <div className="border-t border-slate-200 dark:border-white/5 my-1" />
                <button
                  onClick={() => {
                    setIsWorkspaceDropdownOpen(false);
                    setIsCreateProjectModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Project</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Quick Actions */}
        <div className="hidden lg:flex items-center gap-1.5">
          <button
            id="nav-invite-team-btn"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-colors"
            title="Invite collaborators and manage team workload"
          >
            <UserPlus className="w-3.5 h-3.5 text-purple-400" />
            <span>Invite</span>
          </button>

        </div>

        {/* Right Controls: Streamlined & Clean */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* API Key Status (Desktop) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-slate-300 text-xs font-medium transition-colors"
            title="Gemini API Key & Model Settings"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px] text-slate-300">
              {activeAiProvider ? activeAiProvider.model : 'No AI provider'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>

          {/* Google Workspace Connection (Desktop) */}
          {/* Gemini AI Copilot Button - Visible everywhere with adaptive label */}
          <button
            id="gemini-assistant-btn"
            onClick={() => setIsAiAssistantOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-blue-600/30 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-semibold shadow-sm transition-all hover:border-purple-400"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="hidden sm:inline">AI Copilot</span>
            <span className="sm:hidden text-[11px]">AI</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            id="theme-toggle-btn"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-700/50 dark:border-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center"
            title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-300" />
            )}
          </button>

          {/* Google Drive Sync Modal (Desktop) */}
          <button
            id="google-drive-sync-btn"
            onClick={() => setIsCloudPanelOpen(true)}
            className="hidden md:flex p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-slate-300 transition-colors"
            title="Google Drive Sync & Export"
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              id="notifications-bell-btn"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-slate-300 transition-colors"
              title="Notifications & Deadline Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {isNotifOpen && <NotificationCenter onClose={() => setIsNotifOpen(false)} />}
          </div>

          {/* Desktop User Avatar */}
          <div className="relative hidden md:block">
            <button
              id="user-persona-btn"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-1 ring-white/20"
              />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-64 bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl dark:shadow-2xl p-2 z-50 animate-fadeIn">
                <div className="px-2 py-1.5 border-b border-slate-200 dark:border-white/5 mb-1">
                  <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-200">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{currentUser.email}</p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">{currentUser.role}</p>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Switch Collaborator Persona
                </div>
                {teamMembers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user.id);
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      user.id === currentUser.id
                        ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-800 dark:text-purple-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                    <div className="truncate">
                      <div className="truncate font-medium">{user.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Menu / Hub Button (Replaces cluttered row with 1 clean action sheet) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 transition-colors"
            title="Open Studio Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4 text-purple-400" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>

      {/* Mobile Drawer / Sheet: Clean, uncluttered hub for secondary tools & views */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-12 bottom-0 bg-[#070A10]/98 backdrop-blur-2xl border-t border-white/10 z-[100] p-4 overflow-y-auto space-y-4">
          {/* Studio Navigation Views */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Views & Workspaces
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setActiveViewTab('immediate');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-colors ${
                  activeViewTab === 'immediate'
                    ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 font-semibold'
                    : 'bg-[#0D121F] border-white/10 text-slate-200 hover:border-purple-500/40'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">Focus Dashboard</span>
              </button>
              <button
                onClick={() => {
                  setActiveViewTab('retroplanning');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-colors ${
                  activeViewTab === 'retroplanning'
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-200 font-semibold'
                    : 'bg-[#0D121F] border-white/10 text-slate-200 hover:border-purple-500/40'
                }`}
              >
                <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">Rétroplanning</span>
              </button>
              <button
                onClick={() => {
                  setActiveViewTab('tasks');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-colors ${
                  activeViewTab === 'tasks'
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200 font-semibold'
                    : 'bg-[#0D121F] border-white/10 text-slate-200 hover:border-purple-500/40'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Task Board</span>
              </button>
              <button
                onClick={() => {
                  setActiveViewTab('markdown');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-colors ${
                  activeViewTab === 'markdown'
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-200 font-semibold'
                    : 'bg-[#0D121F] border-white/10 text-slate-200 hover:border-purple-500/40'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">Notes Studio</span>
              </button>
            </div>
          </div>

          {/* Active User Card */}
          <div className="bg-[#0D121F] border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-purple-400/40" />
              <div>
                <div className="text-xs font-semibold text-slate-100">{currentUser.name}</div>
                <div className="text-[10px] text-purple-400">{currentUser.role}</div>
              </div>
            </div>
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-slate-400">Current</span>
          </div>

          {/* Persona Switcher */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Switch Persona
            </div>
            <div className="grid grid-cols-2 gap-2">
              {teamMembers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setCurrentUser(user.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs transition-colors ${
                    user.id === currentUser.id
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
                      : 'bg-[#0D121F] border-white/5 text-slate-300'
                  }`}
                >
                  <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                  <span className="truncate text-[11px]">{user.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Studio Tools */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Studio Tools & Integrations
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsTutorialDrawerOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0D121F] border border-white/10 text-xs text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="w-4 h-4 text-purple-400" />
                  <span>Interactive Tutorial Guide</span>
                </div>
                <span className="text-[10px] text-purple-400">View</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0D121F] border border-white/10 text-xs text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Gemini API & Model Config</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">{activeAiProvider ? activeAiProvider.model : 'Not configured'}</span>
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );
};
