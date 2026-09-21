import React, { useCallback, useRef, useState } from 'react';
import { useApp, useActiveProject, computeProjectHealth } from '../context/AppContext';
import {
  Calendar,
  Clock,
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
  Flame,
  CheckCheck,
  Timer,
  Tv,
} from 'lucide-react';
import { ViewTab } from '../types';
import { parseDay } from '../services/export/common';
import { CloudStatusChip } from './CloudStatusChip';
import { useDismiss } from './navbar/useDismiss';
import { ExportMenu } from './ExportMenu';

export const ProjectHeader: React.FC = () => {
  const {
    projects,
    setActiveProjectId,
    activeViewTab,
    setActiveViewTab,
    setIsCreateTaskModalOpen,
    setIsCreateProjectModalOpen,
    setIsAiAssistantOpen,
  } = useApp();
  const activeProject = useActiveProject();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const closePicker = useCallback(() => setIsProjectDropdownOpen(false), []);
  useDismiss(pickerRef, closePicker, isProjectDropdownOpen);
  const health = computeProjectHealth(activeProject);

  // Every number below comes from `computeProjectHealth`; nothing here is a constant.
  const hasTarget = parseDay(activeProject.targetDeliveryDate) !== null;
  const criticalTasks = activeProject.tasks.filter((t) => t.isCriticalPath).length;
  const completionPercentage = health.tasksTotal > 0 ? Math.round((health.tasksDone / health.tasksTotal) * 100) : null;

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
    <div className="bg-card border-b border-line text-fg px-3 sm:px-4 pt-3 w-full max-w-full transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-3 min-w-0">
        {/* Top Row: Project Selector + Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          {/* Left: Project Selector Dropdown */}
          <div className="relative min-w-0 max-w-full" ref={pickerRef}>
            <button
              id="project-selector-dropdown-btn"
              type="button"
              aria-haspopup="menu"
              aria-expanded={isProjectDropdownOpen}
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="group flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-elevated hover:bg-line border border-line text-left transition-all w-full sm:w-auto max-w-full"
            >
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-sm sm:text-base font-semibold text-fg tracking-tight group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors truncate">
                    {activeProject.title}
                  </h1>
                  <ChevronDown className="w-3.5 h-3.5 text-fg-muted group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-fg-muted flex-wrap">
                  <span className="truncate max-w-[120px]">{activeProject.clientName}</span>
                  <span className="text-fg-subtle">&bull;</span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded-full capitalize text-[9px] ${
                      activeProject.status === 'on-track'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : activeProject.status === 'at-risk'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {activeProject.status.replace('-', ' ')}
                  </span>
                  {activeProject.isTutorialTemplate && (
                    <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1 shrink-0">
                      <GraduationCap className="w-2.5 h-2.5" />
                      <span>Tutorial</span>
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Project Dropdown Menu */}
            {isProjectDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm bg-card border border-line rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
                <div className="text-[10px] font-semibold text-fg-muted px-2.5 py-1 uppercase tracking-wider">
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
                          ? 'bg-purple-600/20 text-purple-800 dark:text-purple-200 font-semibold border border-purple-500/30'
                          : 'text-fg-muted hover:bg-elevated border border-transparent'
                      }`}
                    >
                      <div className="truncate min-w-0 pr-2">
                        <div className="truncate flex items-center gap-1.5 font-medium">
                          <span className="truncate">{p.title}</span>
                          {p.isTutorialTemplate && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 shrink-0">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-fg-muted truncate">{p.clientName}</div>
                      </div>
                      {p.id === activeProject.id && <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-line my-1.5" />
                <button
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    setIsCreateProjectModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Design Project</span>
                </button>
              </div>
            )}
          </div>

          {/* Project actions. App-scoped items (settings, tutorial, invite, theme, notifications,
              account) all live in the navbar menu, so nothing here is offered twice. */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            <CloudStatusChip id="header-drive-folder-btn" />

            {/* Exports: spreadsheets, Markdown, images, JSON, and cloud uploads */}
            <ExportMenu project={activeProject} />

            <button
              id="ai-assistant-btn"
              type="button"
              onClick={() => setIsAiAssistantOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-800 dark:text-purple-200 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              title="Ask the AI assistant about this project"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="hidden sm:inline">AI assistant</span>
              <span className="sm:hidden">AI</span>
            </button>

            <button
              data-tour="new-task"
              type="button"
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>New task</span>
            </button>
          </div>
        </div>

        {/* Metrics strip. Every value is derived by `computeProjectHealth`; when a number cannot be
            computed (no valid target date, no tasks) the slot says so instead of showing a filler. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-elevated border border-line rounded-xl p-2.5 text-xs">
          {/* Target delivery date and the countdown to it */}
          <div className="space-y-1 min-w-0 pr-2">
            <div className="flex items-center gap-1 text-[10px] text-fg-muted uppercase font-semibold tracking-wider">
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">Target delivery</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {hasTarget ? (
                <>
                  <span className="font-semibold text-fg font-mono text-xs sm:text-sm truncate">{activeProject.targetDeliveryDate}</span>
                  <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400">
                    {health.daysRemaining >= 0 ? `${health.daysRemaining}d left` : `${-health.daysRemaining}d past`}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-fg-muted">No target date set</span>
              )}
            </div>
          </div>

          {/* Slack between the end of the schedule and the target */}
          <div className="space-y-1 min-w-0 pr-2 border-l border-line pl-2">
            <div className="flex items-center gap-1 text-[10px] text-fg-muted uppercase font-semibold tracking-wider">
              <Timer className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{hasTarget && health.scheduleEndsAfterTarget ? 'Overrun' : 'Slack'}</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {hasTarget ? (
                <>
                  <span
                    className={`font-semibold text-xs sm:text-sm ${
                      health.scheduleEndsAfterTarget ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {Math.abs(health.slackDays)}d
                  </span>
                  <span className="text-[10px] text-fg-muted">
                    {health.scheduleEndsAfterTarget ? 'past the target' : 'before the target'}
                    {health.overdueTasks > 0 ? ` · ${health.overdueTasks} overdue` : ''}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-fg-muted">
                  Needs a target date{health.overdueTasks > 0 ? ` · ${health.overdueTasks} overdue` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Tasks the user has flagged critical. The computed critical path lives on the timeline. */}
          <div className="space-y-1 min-w-0 pr-2 sm:border-l sm:border-line sm:pl-2">
            <div className="flex items-center gap-1 text-[10px] text-fg-muted uppercase font-semibold tracking-wider">
              <Flame className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="truncate">Flagged critical</span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">{criticalTasks}</span>
              <span className="text-[10px] text-fg-muted">{criticalTasks === 1 ? 'task' : 'tasks'}</span>
            </div>
          </div>

          {/* Completed tasks */}
          <div className="space-y-1 min-w-0 border-l border-line pl-2">
            <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase font-semibold tracking-wider">
              <div className="flex items-center gap-1 truncate">
                <CheckCheck className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="truncate">Tasks done</span>
              </div>
              {completionPercentage !== null && (
                <span className="text-purple-700 dark:text-purple-300 font-mono text-[10px]">{completionPercentage}%</span>
              )}
            </div>
            {completionPercentage === null ? (
              <p className="text-[11px] text-fg-muted">No task yet</p>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-fg">
                  {health.tasksDone}/{health.tasksTotal} completed
                </div>
                <div className="w-full bg-line h-1 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${completionPercentage}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Tabs Navigation - Responsive Segmented Bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-line pt-1.5 -mx-3 px-3 sm:mx-0 sm:px-0">
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
                    ? 'bg-elevated text-fg shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-elevated'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-fg-muted'}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full shrink-0 ${
                      isActive ? 'bg-purple-500/30 text-purple-800 dark:text-purple-200' : 'bg-elevated text-fg-muted'
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
