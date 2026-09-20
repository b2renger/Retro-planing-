import React, { useState, useMemo } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import {
  Calendar,
  Clock,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Plus,
  Filter,
  CheckCircle2,
  Flag,
  ArrowRight,
  Zap,
  Flame,
  CheckCheck,
  BarChart3,
  SlidersHorizontal,
  Compass,
  TrendingUp,
  Target,
  User,
  Users,
} from 'lucide-react';
import { Task, Phase, Milestone, TaskStatus } from '../types';
import { Modal } from './ui/Modal';
import { analyzeDependencies } from '../services/ai/tasks';

export const RetroplanningTimeline: React.FC = () => {
  const {
    updatePhaseDates,
    updateTargetDeliveryDate,
    toggleMilestoneComplete,
    addMilestone,
    addNotification,
    teamMembers,
    updateTaskStatus,
    toggleChecklistItem,
    activeAiProvider,
  } = useApp();
  const activeProject = useActiveProject();

  const [graphicMode, setGraphicMode] = useState<'gantt' | 'runway' | 'workload'>('gantt');
  const [zoomLevel, setZoomLevel] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [highlightCriticalPath, setHighlightCriticalPath] = useState(true);
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('all');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  // Parse start and end timeline bounds
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let minDate = new Date(activeProject.startDate || '2026-09-01');
    let maxDate = new Date(activeProject.targetDeliveryDate || '2026-11-20');

    // Add extra padding around bounds
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 5);

    const diffDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      timelineStart: minDate,
      timelineEnd: maxDate,
      totalDays: Math.max(diffDays, 30),
    };
  }, [activeProject.startDate, activeProject.targetDeliveryDate]);

  // Compute percentage position along timeline
  const getPositionPercentage = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diff = d.getTime() - timelineStart.getTime();
      const pct = (diff / (1000 * 60 * 60 * 24 * totalDays)) * 100;
      return Math.max(0, Math.min(100, pct));
    } catch {
      return 50;
    }
  };

  const getWidthPercentage = (startStr: string, endStr: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const diff = e.getTime() - s.getTime();
      const pct = (diff / (1000 * 60 * 60 * 24 * totalDays)) * 100;
      return Math.max(3, Math.min(100, pct));
    } catch {
      return 15;
    }
  };

  // Generate timeline tick headers
  const ticks = useMemo(() => {
    const list: { label: string; pct: number }[] = [];
    const count = zoomLevel === 'days' ? 18 : zoomLevel === 'weeks' ? 8 : 4;
    for (let i = 0; i <= count; i++) {
      const d = new Date(timelineStart.getTime() + (i / count) * (timelineEnd.getTime() - timelineStart.getTime()));
      list.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pct: (i / count) * 100,
      });
    }
    return list;
  }, [timelineStart, timelineEnd, zoomLevel]);

  // Calculate days remaining to target launch
  const calculateDaysRemaining = (targetDateStr: string) => {
    try {
      const today = new Date();
      const target = new Date(targetDateStr);
      const diffTime = target.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 60;
    }
  };

  const daysRemaining = calculateDaysRemaining(activeProject.targetDeliveryDate);

  // Filter tasks based on selected dropdowns
  const filteredTasks = useMemo(() => {
    return activeProject.tasks.filter((t) => {
      const matchPhase = selectedPhaseFilter === 'all' || t.phaseId === selectedPhaseFilter;
      const matchAssignee = selectedAssigneeFilter === 'all' || t.assigneeId === selectedAssigneeFilter;
      return matchPhase && matchAssignee;
    });
  }, [activeProject.tasks, selectedPhaseFilter, selectedAssigneeFilter]);

  const handleRunAiOptimizer = async () => {
    setIsOptimizing(true);
    try {
      const result = await analyzeDependencies(
        { tasks: activeProject.tasks, targetDeliveryDate: activeProject.targetDeliveryDate, projectName: activeProject.title },
        activeAiProvider
      );

      addNotification({
        title: result.fallback ? 'Local heuristic analysis (no AI provider)' : 'AI analysis complete',
        message: result.analysis.executiveSummary || 'No summary returned.',
        type: 'ai_insight',
        projectId: activeProject.id,
      });
    } catch {
      addNotification({
        title: 'Analysis failed',
        message: 'The dependency analysis could not be completed.',
        type: 'ai_insight',
        projectId: activeProject.id,
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAddMilestoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle || !newMilestoneDate) return;
    addMilestone({
      title: newMilestoneTitle,
      targetDate: newMilestoneDate,
      isHardDeadline: true,
      completed: false,
      description: 'Designer retroplanning milestone checkpoint',
      deliverableCount: 4,
    });
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
    setShowAddMilestone(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden animate-fadeIn">
      {/* Visual Command Header & Graphic Mode Controls */}
      <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-2xl bg-gradient-to-r from-purple-500/10 dark:from-purple-950/40 via-card to-indigo-500/5 dark:to-indigo-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Reverse Planning Anchor & Buffer Safety */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Target Delivery Anchor (Reverse Planning Anchor) */}
            <div className="bg-elevated border border-line rounded-xl px-3.5 py-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Flag className="w-4 h-4" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-fg-muted block tracking-wider">
                  Target Launch Anchor (Rétroplanning)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    id="retroplanning-target-date-input"
                    value={activeProject.targetDeliveryDate}
                    onChange={(e) => updateTargetDeliveryDate(e.target.value, 'anchor-only')}
                    className="bg-transparent text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 focus:outline-none cursor-pointer font-mono"
                  />
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
                    {daysRemaining}d runway
                  </span>
                </div>
              </div>
            </div>

            {/* Buffer Safety Score */}
            <div className="bg-elevated border border-line rounded-xl px-3.5 py-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-fg-muted tracking-wider">
                  Backward Buffer Margin
                </div>
                <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>{activeProject.retroplanningScore}% Safe</span>
                  <span className="text-[10px] text-fg-muted font-normal">&bull; 6d Buffer</span>
                </div>
              </div>
            </div>

            {/* Critical Path Toggle */}
            <button
              id="toggle-critical-path-btn"
              onClick={() => setHighlightCriticalPath(!highlightCriticalPath)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                highlightCriticalPath
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                  : 'bg-elevated text-fg-muted border-line hover:text-fg'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${highlightCriticalPath ? 'text-rose-600 dark:text-rose-400' : 'text-fg-muted'}`} />
              <span>Critical Path {highlightCriticalPath ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Right: Graphic Views Switcher, Zoom & AI Optimizer */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Graphic Mode Selector */}
            <div className="flex items-center bg-elevated border border-line rounded-xl p-1 text-xs">
              <button
                id="mode-gantt-btn"
                onClick={() => setGraphicMode('gantt')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  graphicMode === 'gantt'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Gantt Chart</span>
              </button>
              <button
                id="mode-runway-btn"
                onClick={() => setGraphicMode('runway')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  graphicMode === 'runway'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Milestone Runway</span>
              </button>
              <button
                id="mode-workload-btn"
                onClick={() => setGraphicMode('workload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  graphicMode === 'workload'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Workload Curve</span>
              </button>
            </div>

            {/* AI Optimizer Trigger */}
            <button
              id="ai-retroplan-optimizer-btn"
              onClick={handleRunAiOptimizer}
              disabled={isOptimizing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'Optimizing...' : 'AI Retroplan Optimizer'}</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter & Tool Bar */}
        <div className="mt-4 pt-3.5 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-fg-muted">
              <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Filters:</span>
            </div>

            {/* Phase Filter */}
            <select
              value={selectedPhaseFilter}
              onChange={(e) => setSelectedPhaseFilter(e.target.value)}
              className="bg-input border border-line rounded-lg px-2.5 py-1 text-xs text-fg focus:outline-none"
            >
              <option value="all">All Phases ({activeProject.phases.length})</option>
              {activeProject.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Assignee Filter */}
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className="bg-input border border-line rounded-lg px-2.5 py-1 text-xs text-fg focus:outline-none"
            >
              <option value="all">All Assignees ({teamMembers.length})</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>

            {(selectedPhaseFilter !== 'all' || selectedAssigneeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSelectedPhaseFilter('all');
                  setSelectedAssigneeFilter('all');
                }}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Zoom scale & Add milestone */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-elevated border border-line rounded-lg p-0.5 text-[11px]">
              {(['days', 'weeks', 'months'] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-2 py-0.5 rounded capitalize font-medium transition-colors ${
                    zoomLevel === z ? 'bg-purple-600 text-white font-semibold' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            <button
              id="toggle-add-milestone-btn"
              onClick={() => setShowAddMilestone(!showAddMilestone)}
              className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-line border border-line text-fg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Milestone</span>
            </button>
          </div>
        </div>

        {/* Add Milestone Form */}
        {showAddMilestone && (
          <form
            onSubmit={handleAddMilestoneSubmit}
            className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-2 text-xs"
          >
            <input
              type="text"
              placeholder="Milestone title (e.g. Design Tokens Freeze)..."
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-input border border-line text-fg placeholder-fg-subtle focus:outline-none focus:border-purple-500 flex-1 min-w-[200px]"
            />
            <input
              type="date"
              value={newMilestoneDate}
              onChange={(e) => setNewMilestoneDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-input border border-line text-fg focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
            >
              Save Milestone
            </button>
            <button
              type="button"
              onClick={() => setShowAddMilestone(false)}
              className="px-2.5 py-1.5 text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* GRAPHIC VIEW 1: GANTT CHART & BACKWARD TRACKS */}
      {graphicMode === 'gantt' && (
        <div className="bg-card border border-line rounded-2xl p-4 sm:p-6 shadow-2xl overflow-x-auto space-y-6">
          <div className="min-w-[800px] space-y-6">
            {/* Time Axis Header & Milestones */}
            <div className="relative border-b border-line pb-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-fg-muted">
                {ticks.map((t, i) => (
                  <div key={i} className="text-center" style={{ minWidth: '60px' }}>
                    {t.label}
                  </div>
                ))}
              </div>

              {/* Milestones Flag Bar */}
              <div className="relative h-11 mt-2.5 bg-elevated rounded-xl border border-line px-2 overflow-hidden">
                {activeProject.milestones.map((ms) => {
                  const pct = getPositionPercentage(ms.targetDate);
                  return (
                    <div
                      key={ms.id}
                      onClick={() => toggleMilestoneComplete(ms.id)}
                      title={`Milestone: ${ms.title} (${ms.targetDate}) - Click to toggle completion status`}
                      className="absolute top-1.5 -translate-x-1/2 flex flex-col items-center cursor-pointer group z-20"
                      style={{ left: `${pct}%` }}
                    >
                      <div
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md transition-all ${
                          ms.completed
                            ? 'bg-emerald-600 text-white border border-emerald-400'
                            : 'bg-amber-400 text-slate-950 font-extrabold border border-amber-200 group-hover:scale-105'
                        }`}
                      >
                        <Flag className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[130px]">{ms.title}</span>
                      </div>
                      <div
                        className={`w-0.5 h-3 mt-0.5 ${
                          ms.completed ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phases & Backwards Scheduled Lanes */}
            <div className="space-y-6">
              {activeProject.phases
                .filter((p) => selectedPhaseFilter === 'all' || p.id === selectedPhaseFilter)
                .map((phase) => {
                  const phaseTasks = filteredTasks.filter((t) => t.phaseId === phase.id);
                  const phaseStartPct = getPositionPercentage(phase.startDate);
                  const phaseWidthPct = getWidthPercentage(phase.startDate, phase.endDate);

                  return (
                    <div key={phase.id} className="space-y-2">
                      {/* Phase Container Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.color }} />
                          <h4 className="text-xs font-bold text-fg">{phase.name}</h4>
                          <span className="text-[10px] font-mono text-fg-muted">
                            {phase.startDate} &rarr; {phase.endDate} ({phase.bufferDays}d backward buffer)
                          </span>
                        </div>

                        <div className="text-[10px] text-fg-muted font-mono">
                          {phaseTasks.filter((t) => t.status === 'done').length}/{phaseTasks.length} Deliverables Done
                        </div>
                      </div>

                      {/* Phase Timeline Track */}
                      <div className="relative h-14 bg-elevated border border-line rounded-xl p-1.5 overflow-hidden">
                        {/* Phase Background Envelope */}
                        <div
                          className="absolute top-1.5 bottom-1.5 rounded-lg opacity-20"
                          style={{
                            left: `${phaseStartPct}%`,
                            width: `${phaseWidthPct}%`,
                            backgroundColor: phase.color,
                            border: `1px solid ${phase.color}`,
                          }}
                        />

                        {/* Phase Task Bars */}
                        {phaseTasks.map((task) => {
                          const taskStartPct = getPositionPercentage(task.startDate);
                          const taskWidthPct = getWidthPercentage(task.startDate, task.dueDate);
                          const assignee = teamMembers.find((u) => u.id === task.assigneeId) || teamMembers[0];
                          const isCritical = highlightCriticalPath && task.isCriticalPath;

                          return (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className={`absolute top-2 bottom-2 rounded-lg px-2.5 flex items-center justify-between text-[11px] font-medium cursor-pointer shadow-md transition-all hover:scale-[1.01] hover:z-30 ${
                                task.status === 'done'
                                  ? 'bg-emerald-500/20 dark:bg-emerald-950/80 border border-emerald-500/50 text-emerald-800 dark:text-emerald-200'
                                  : isCritical
                                  ? 'bg-rose-500/20 dark:bg-rose-950/90 border-2 border-rose-500 text-rose-800 dark:text-rose-100 font-bold animate-pulse'
                                  : 'bg-elevated border border-line-strong text-fg hover:border-purple-400'
                              }`}
                              style={{
                                left: `${taskStartPct}%`,
                                width: `${taskWidthPct}%`,
                              }}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <img
                                  src={assignee.avatar}
                                  alt={assignee.name}
                                  className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-line-strong"
                                />
                                <span className="truncate">{task.title}</span>
                              </div>

                              <span className="text-[9px] font-mono shrink-0 ml-1 opacity-80">
                                {task.estimatedHours}h
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Reverse Buffer Legend & Safety Margin Summary */}
            <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between text-xs text-fg-muted gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-rose-500/90 border border-rose-400" />
                  <span>Critical Path (Zero Float to Launch)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-400" />
                  <span>Milestone Checkpoint</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500/80" />
                  <span>Completed Deliverable</span>
                </div>
              </div>

              <div className="text-[11px] text-fg-muted font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Rétroplanning lock: 6 days safety margin before delivery</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRAPHIC VIEW 2: MILESTONE RUNWAY & COUNTDOWN RADAR */}
      {graphicMode === 'runway' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Milestone Checkpoints List (2 cols) */}
          <div className="lg:col-span-2 bg-card border border-line rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-bold text-xs text-fg uppercase tracking-wider flex items-center gap-2">
                <Flag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Hard Deadlines & Milestone Readiness</span>
              </h3>
              <span className="text-xs text-purple-700 dark:text-purple-300 font-mono">
                {activeProject.milestones.filter((m) => m.completed).length} / {activeProject.milestones.length} Reached
              </span>
            </div>

            <div className="space-y-3">
              {activeProject.milestones.map((ms, idx) => (
                <div
                  key={ms.id}
                  onClick={() => toggleMilestoneComplete(ms.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    ms.completed
                      ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-elevated border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          ms.completed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-fg">{ms.title}</h4>
                          {ms.completed && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-fg-muted mt-0.5">{ms.description}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">{ms.targetDate}</div>
                      <div className="text-[10px] text-fg-muted">{ms.deliverableCount} deliverables</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch Radar Card (1 col) */}
          <div className="bg-card border border-line rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="font-bold text-xs text-fg uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Launch Countdown Runway</span>
              </h3>

              <div className="bg-elevated border border-line rounded-xl p-4 text-center space-y-1">
                <div className="text-4xl font-extrabold font-mono text-amber-600 dark:text-amber-400">{daysRemaining}</div>
                <div className="text-xs text-fg-muted uppercase tracking-wider font-semibold">Days Until Target Delivery</div>
                <div className="text-[11px] text-fg-muted pt-1">
                  Target: <strong className="text-fg">{activeProject.targetDeliveryDate}</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-fg-muted">
                  <span>Backward Buffer Safety:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeProject.retroplanningScore}% Safe</span>
                </div>
                <div className="w-full h-2 bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${activeProject.retroplanningScore}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-line text-xs text-fg-muted space-y-1.5">
              <div className="flex items-center gap-1.5 text-fg-muted font-semibold">
                <CheckCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Zero Critical Path Slacks</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                All reverse scheduled milestones are locked against client review deadlines.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GRAPHIC VIEW 3: WORKLOAD & RESOURCE CURVE */}
      {graphicMode === 'workload' && (
        <div className="bg-card border border-line rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-xs text-fg uppercase tracking-wider">
                Phase-by-Phase Hours Distribution
              </h3>
            </div>
            <span className="text-xs text-purple-700 dark:text-purple-300 font-mono">
              Total Scope: {activeProject.tasks.reduce((a, b) => a + (b.estimatedHours || 0), 0)} Hours
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeProject.phases.map((phase) => {
              const phaseTasks = activeProject.tasks.filter((t) => t.phaseId === phase.id);
              const phaseHours = phaseTasks.reduce((a, b) => a + (b.estimatedHours || 0), 0);
              const completedHours = phaseTasks
                .filter((t) => t.status === 'done')
                .reduce((a, b) => a + (b.estimatedHours || 0), 0);
              const pct = phaseHours > 0 ? Math.round((completedHours / phaseHours) * 100) : 0;

              return (
                <div key={phase.id} className="bg-elevated border border-line rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
                      <span className="font-bold text-xs text-fg">{phase.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">{phaseHours}h</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-fg-muted">
                      <span>Progress:</span>
                      <span>{completedHours}/{phaseHours}h ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: phase.color }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-fg-muted">
                    {phaseTasks.length} deliverables assigned
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Inspection Modal / Drawer when clicked */}
      {selectedTask && (
        <Modal
          open
          onClose={() => setSelectedTask(null)}
          title={selectedTask.title}
          subtitle={
            <span className="uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider text-[10px]">
              Deliverable Inspector
            </span>
          }
          size="lg"
          bodyClassName="overflow-y-auto px-5 py-4 space-y-4"
          footer={
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-fg-muted">Status:</span>
                <select
                  value={selectedTask.status}
                  aria-label="Task status"
                  onChange={(e) => {
                    updateTaskStatus(selectedTask.id, e.target.value as TaskStatus);
                    setSelectedTask({ ...selectedTask, status: e.target.value as TaskStatus });
                  }}
                  className="bg-input border border-line rounded-lg px-2.5 py-1 text-xs text-fg focus:outline-none"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          }
        >
            <p className="text-xs text-fg-muted leading-relaxed">{selectedTask.description}</p>

            <div className="grid grid-cols-2 gap-3 text-xs bg-elevated p-3 rounded-xl border border-line">
              <div>
                <span className="text-fg-muted block text-[10px]">Start Date:</span>
                <span className="font-semibold text-fg font-mono">{selectedTask.startDate}</span>
              </div>
              <div>
                <span className="text-fg-muted block text-[10px]">Due Date:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">{selectedTask.dueDate}</span>
              </div>
              <div>
                <span className="text-fg-muted block text-[10px]">Estimated Effort:</span>
                <span className="font-semibold text-purple-700 dark:text-purple-300 font-mono">{selectedTask.estimatedHours} hrs</span>
              </div>
              <div>
                <span className="text-fg-muted block text-[10px]">Critical Path:</span>
                <span className={`font-bold ${selectedTask.isCriticalPath ? 'text-rose-600 dark:text-rose-400' : 'text-fg-muted'}`}>
                  {selectedTask.isCriticalPath ? '🔥 Zero Float Locked' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Checklist */}
            {selectedTask.checklist.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-fg-muted block">Subtask Checklist:</span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {selectedTask.checklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklistItem(selectedTask.id, item.id)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-elevated cursor-pointer text-xs text-fg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        className="rounded border-line-strong bg-input text-purple-600 focus:ring-purple-500"
                      />
                      <span className={item.completed ? 'line-through text-fg-muted' : ''}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

        </Modal>
      )}
    </div>
  );
};
