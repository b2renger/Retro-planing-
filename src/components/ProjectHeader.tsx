import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar,
  Clock,
  ShieldCheck,
  ChevronDown,
  Plus,
  Zap,
  Sparkles,
  FileText,
  Kanban,
  GitCommit,
  Users,
  CheckCircle2,
  GraduationCap,
  AlertTriangle,
  Flame,
  CheckCheck,
  Database,
  UserPlus,
  Play,
  HardDrive,
  Tv,
} from 'lucide-react';
import { ViewTab } from '../types';

export const ProjectHeader: React.FC = () => {
  const {
    projects,
    activeProject,
    setActiveProjectId,
    activeViewTab,
    setActiveViewTab,
    setIsCreateTaskModalOpen,
    setIsCreateProjectModalOpen,
    setIsDatabaseTesterOpen,
    setIsInviteModalOpen,
    setIsInteractiveDemoOpen,
    setIsDriveModalOpen,
    teamMembers,
  } = useApp();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  // Calculate days remaining to target delivery date
  const calculateDaysRemaining = (targetDateStr: string) => {
    try {
      const today = new Date();
      const target = new Date(targetDateStr);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 60;
    }
  };

  const daysRemaining = calculateDaysRemaining(activeProject.targetDeliveryDate);

  // Calculate granular retroplanning metrics
  const totalTasks = activeProject.tasks.length;
  const completedTasks = activeProject.tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = activeProject.tasks.filter((t) => t.status === 'in-progress').length;
  const criticalTasks = activeProject.tasks.filter((t) => t.isCriticalPath).length;
  const unresolvedQuestions = activeProject.clarificationQuestions.filter((q) => !q.resolved).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const tabs: { id: ViewTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    {
      id: 'retroplanning',
      label: 'Visual Rétroplanning',
      icon: Calendar,
      badge: criticalTasks,
    },
    {
      id: 'hardware',
      label: 'Hardware & Media Spec',
      icon: Tv,
      badge: (activeProject.hardwareItems?.length || 0) + (activeProject.mediaAssets?.length || 0),
    },
    {
      id: 'immediate',
      label: 'Triage & Actions',
      icon: Zap,
      badge: activeProject.tasks.filter((t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high')).length || undefined,
    },
    {
      id: 'tasks',
      label: 'Tasks & Deliverables',
      icon: Kanban,
      badge: activeProject.tasks.length,
    },
    {
      id: 'markdown',
      label: 'Markdown Studio & AI',
      icon: FileText,
      badge: activeProject.documents.length,
    },
    {
      id: 'collaboration',
      label: 'Team & Workload',
      icon: Users,
    },
    {
      id: 'history',
      label: 'Audit Trail',
      icon: GitCommit,
      badge: activeProject.history.length,
    },
  ];

  return (
    <div className="bg-white dark:bg-[#0B0F17] border-b border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 px-3 sm:px-4 pt-3 w-full max-w-full transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-3 min-w-0">
        {/* Top Row: Project Selector + Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          {/* Left: Project Selector Dropdown */}
          <div className="relative min-w-0 max-w-full">
            <button
              id="project-selector-dropdown-btn"
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="group flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-left transition-all w-full sm:w-auto max-w-full"
            >
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight group-hover:text-purple-300 transition-colors truncate">
                    {activeProject.title}
                  </h1>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-300 transition-colors shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-400 flex-wrap">
                  <span className="truncate max-w-[120px]">{activeProject.clientName}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded-full capitalize text-[9px] ${
                      activeProject.status === 'on-track'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : activeProject.status === 'at-risk'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {activeProject.status.replace('-', ' ')}
                  </span>
                  {activeProject.isTutorialTemplate && (
                    <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 shrink-0">
                      <GraduationCap className="w-2.5 h-2.5" />
                      <span>Tutorial</span>
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Project Dropdown Menu */}
            {isProjectDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm bg-[#0D121F] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
                <div className="text-[10px] font-semibold text-slate-400 px-2.5 py-1 uppercase tracking-wider">
                  Select Design Project
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setIsProjectDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all ${
                        p.id === activeProject.id
                          ? 'bg-purple-600/20 text-purple-200 font-semibold border border-purple-500/30'
                          : 'text-slate-300 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="truncate min-w-0 pr-2">
                        <div className="truncate flex items-center gap-1.5 font-medium">
                          <span className="truncate">{p.title}</span>
                          {p.isTutorialTemplate && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 shrink-0">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{p.clientName}</div>
                      </div>
                      {p.id === activeProject.id && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/5 my-1.5" />
                <button
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    setIsCreateProjectModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-purple-400 hover:bg-purple-500/10 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Design Project</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Fast Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            {/* Team Collaborator Avatar Stack & Invite Trigger */}
            <div className="flex items-center bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-1 pr-2 gap-1.5 transition-all">
              <div className="flex -space-x-1.5 overflow-hidden pl-1">
                {teamMembers.slice(0, 3).map((m) => (
                  <img
                    key={m.id}
                    src={m.avatar}
                    alt={m.name}
                    title={`${m.name} (${m.role})`}
                    className="inline-block h-5 w-5 rounded-full ring-1 ring-[#0B0F17] object-cover"
                  />
                ))}
              </div>
              <button
                id="header-invite-btn"
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition-colors"
                title="Invite collaborators to this project"
              >
                <UserPlus className="w-3 h-3" />
                <span>Invite</span>
              </button>
            </div>

            {/* Dedicated Google Drive Project Folder */}
            <button
              id="header-drive-folder-btn"
              onClick={() => setIsDriveModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors"
              title={`Open dedicated Google Drive folder: ${activeProject.title}`}
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden sm:inline">Drive Folder</span>
              <span className="sm:hidden">Drive</span>
              {activeProject.driveSynced && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* Interactive Demo Launcher */}
            <button
              id="header-interactive-tour-btn"
              onClick={() => setIsInteractiveDemoOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-semibold transition-colors"
              title="Launch full interactive tour with live demonstration of all features"
            >
              <GraduationCap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="hidden sm:inline">Feature Tour</span>
              <span className="sm:hidden">Tour</span>
            </button>

            {/* Live Database Status & Durability Test Suite */}
            <button
              onClick={() => setIsDatabaseTesterOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
              title="Click to run 8 live production tests (Rétroplanning math, task state machine, storage durability)"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">DB Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <button
              onClick={() => setActiveViewTab('markdown')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden xs:inline">Crunch Notes</span>
              <span className="xs:hidden">Notes</span>
            </button>

            <button
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Informative Rétroplanning Metrics Strip: High Information Density, Zero Clutter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/[0.02] border border-white/10 rounded-xl p-2.5 text-xs">
          {/* Metric 1: Delivery Runway & Countdown */}
          <div className="space-y-1 min-w-0 pr-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">Target Launch</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-100 font-mono text-xs sm:text-sm truncate">
                {activeProject.targetDeliveryDate}
              </span>
              <span className="text-[10px] text-amber-400 font-mono font-semibold">
                ({daysRemaining}d left)
              </span>
            </div>
          </div>

          {/* Metric 2: Rétroplanning Buffer Health */}
          <div className="space-y-1 min-w-0 pr-2 border-l border-white/5 pl-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Buffer Safety</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-emerald-400 text-xs sm:text-sm">
                {activeProject.retroplanningScore}% Safe
              </span>
              <span className="text-[10px] text-slate-400">
                (6d margin)
              </span>
            </div>
          </div>

          {/* Metric 3: Critical Path Zero-Float Tasks */}
          <div className="space-y-1 min-w-0 pr-2 sm:border-l sm:border-white/5 sm:pl-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              <Flame className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">Critical Path</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-rose-300 text-xs sm:text-sm">
                {criticalTasks} Tasks Locked
              </span>
              <span className="text-[10px] text-slate-400">Zero Slack</span>
            </div>
          </div>

          {/* Metric 4: Deliverables Velocity & Progress */}
          <div className="space-y-1 min-w-0 border-l border-white/5 pl-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              <div className="flex items-center gap-1 truncate">
                <CheckCheck className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">Deliverables</span>
              </div>
              <span className="text-purple-300 font-mono text-[10px]">{completionPercentage}%</span>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-200">
                {completedTasks}/{totalTasks} Completed
              </div>
              <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* View Tabs Navigation - Responsive Segmented Bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-white/5 pt-1.5 -mx-3 px-3 sm:mx-0 sm:px-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeViewTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveViewTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full shrink-0 ${
                      isActive ? 'bg-purple-500/30 text-purple-200' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
