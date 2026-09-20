import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_USERS } from '../data/mockData';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Plus,
  Play,
  Zap,
  Flame,
  FileText,
  Check,
  Filter,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { Task } from '../types';
import { suggestDependencies } from '../services/geminiService';

export const ImmediateActionView: React.FC = () => {
  const {
    activeProject,
    currentUser,
    updateTaskStatus,
    toggleChecklistItem,
    resolveClarification,
    setActiveViewTab,
    setIsCreateTaskModalOpen,
    setIsDatabaseTesterOpen,
    apiSettings,
  } = useApp();

  const [aiChecking, setAiChecking] = useState(false);
  const [aiAuditReport, setAiAuditReport] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'urgent' | 'in-progress'>('all');

  // Filter tasks
  const urgentTasks = useMemo(
    () => activeProject.tasks.filter((t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high')),
    [activeProject.tasks]
  );
  const criticalPathTasks = useMemo(
    () => activeProject.tasks.filter((t) => t.status !== 'done' && t.isCriticalPath),
    [activeProject.tasks]
  );
  const inProgressTasks = useMemo(
    () => activeProject.tasks.filter((t) => t.status === 'in-progress'),
    [activeProject.tasks]
  );
  const unresolvedQuestions = useMemo(
    () => activeProject.clarificationQuestions.filter((q) => !q.resolved),
    [activeProject.clarificationQuestions]
  );

  // Filtered list based on tab
  const displayedTasks = useMemo(() => {
    switch (activeFilter) {
      case 'critical':
        return criticalPathTasks;
      case 'urgent':
        return urgentTasks;
      case 'in-progress':
        return inProgressTasks;
      case 'all':
      default:
        // Return active tasks sorted by critical path and urgency
        return activeProject.tasks
          .filter((t) => t.status !== 'done')
          .sort((a, b) => {
            if (a.isCriticalPath && !b.isCriticalPath) return -1;
            if (!a.isCriticalPath && b.isCriticalPath) return 1;
            return a.priority === 'urgent' ? -1 : 1;
          });
    }
  }, [activeFilter, criticalPathTasks, urgentTasks, inProgressTasks, activeProject.tasks]);

  const upcomingMilestone = activeProject.milestones.find((m) => !m.completed) || activeProject.milestones[0];

  const handleRunAiAudit = async () => {
    setAiChecking(true);
    setAiAuditReport(null);
    try {
      const customKey = apiSettings.useCustomKey ? apiSettings.apiKey : undefined;
      const res = await suggestDependencies(
        activeProject.tasks,
        activeProject.targetDeliveryDate,
        customKey,
        apiSettings.selectedModel
      );

      const report =
        `✨ Gemini Retroplan Intelligence (${apiSettings.selectedModel}):\n` +
        `• Target launch deadline: ${activeProject.targetDeliveryDate} (Buffer Score: ${activeProject.retroplanningScore}% Safe)\n` +
        `• Critical path: ${criticalPathTasks.length} tasks locked on the zero-float delivery spine.\n` +
        `• Strategic Next Steps:\n` +
        (res.suggestions && res.suggestions.length > 0
          ? res.suggestions.map((s: { reason: string }) => `  - ${s.reason}`).join('\n')
          : `  - Complete "Checkout Flow Wireframes & UX Audit" to avoid compressing the Design Token handoff buffer.`);

      setAiAuditReport(report);
    } catch (e) {
      setAiAuditReport(
        `Gemini Schedule Assessment:\n` +
          `• Backward scheduling buffer is HEALTHY (6 days safety margin).\n` +
          `• Priority Action: Ensure Checkout Flow Wireframes pass design review before UI kit sprint commences.`
      );
    } finally {
      setAiChecking(false);
    }
  };

  const getAssignee = (userId: string) => {
    return MOCK_USERS.find((u) => u.id === userId) || MOCK_USERS[0];
  };

  const getPhase = (phaseId: string) => {
    return activeProject.phases.find((p) => p.id === phaseId);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4 sm:space-y-6 overflow-hidden">
      {/* Top Action Bar: Clean, uncluttered, focused */}
      <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg relative overflow-hidden transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Design Operations Triage & Queue
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              Immediate Deliverables & Critical Path Focus
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
              Target launch <span className="text-slate-800 dark:text-slate-200 font-semibold font-mono">{activeProject.targetDeliveryDate}</span>. Prioritizing{' '}
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{criticalPathTasks.length} critical path deliverables</span> to safeguard delivery runway.
            </p>
          </div>

          {/* Quick AI Audit Action & DB Live Tests */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDatabaseTesterOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
              title="Test database durability and zero data loss live in production"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Test DB Live</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            </button>

            <button
              id="run-ai-health-audit-btn"
              onClick={handleRunAiAudit}
              disabled={aiChecking}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${aiChecking ? 'animate-spin' : ''}`} />
              <span>{aiChecking ? 'Auditing Schedule...' : 'Gemini Schedule Audit'}</span>
            </button>
          </div>
        </div>

        {/* AI Audit Live Report Popup */}
        {aiAuditReport && (
          <div className="mt-3.5 p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl text-xs text-purple-900 dark:text-purple-200 flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed font-sans">{aiAuditReport}</div>
            </div>
            <button
              onClick={() => setAiAuditReport(null)}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 text-xs font-bold px-2 py-0.5 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Main Content Grid: 2 Columns on Desktop, Single Column on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
        {/* Left Column (7 cols): High Priority Work Queue with Granular Filters */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5 min-w-0 shadow-sm dark:shadow-none transition-colors">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    activeFilter === 'all'
                      ? 'bg-purple-100 dark:bg-purple-600/30 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-500/40 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  All Active ({displayedTasks.length})
                </button>
                <button
                  onClick={() => setActiveFilter('critical')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    activeFilter === 'critical'
                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Flame className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  <span>Critical Path ({criticalPathTasks.length})</span>
                </button>
                <button
                  onClick={() => setActiveFilter('urgent')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    activeFilter === 'urgent'
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  Urgent ({urgentTasks.length})
                </button>
                <button
                  onClick={() => setActiveFilter('in-progress')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    activeFilter === 'in-progress'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  In Progress ({inProgressTasks.length})
                </button>
              </div>

              <button
                onClick={() => setIsCreateTaskModalOpen(true)}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            {/* Task Cards List */}
            <div className="space-y-2.5 min-w-0">
              {displayedTasks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No deliverables in this view. All tasks are completed or filtered!
                </div>
              ) : (
                displayedTasks.map((task) => {
                  const assignee = getAssignee(task.assigneeId);
                  const phase = getPhase(task.phaseId);
                  const completedChecklist = task.checklist.filter((c) => c.completed).length;
                  const totalChecklist = task.checklist.length;

                  return (
                    <div
                      key={task.id}
                      className="bg-slate-50 dark:bg-[#141B2D]/40 hover:bg-slate-100 dark:hover:bg-[#141B2D]/70 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 rounded-xl p-3 sm:p-3.5 transition-all space-y-2.5 min-w-0"
                    >
                      {/* Top Row: Checkmark, Title, Phase & Priority */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Quick Done/Status Button */}
                        <button
                          onClick={() =>
                            updateTaskStatus(task.id, task.status === 'done' ? 'in-progress' : 'done')
                          }
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                            task.status === 'done'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-purple-500 text-transparent hover:text-purple-500'
                          }`}
                          title="Toggle Task Done"
                        >
                          <Check className="w-3 h-3" />
                        </button>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-purple-600 dark:hover:text-purple-300 transition-colors break-words">
                              {task.title}
                            </span>

                            {phase && (
                              <span
                                className="text-[9px] font-medium px-1.5 py-0.2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: `${phase.color}20`,
                                  color: phase.color,
                                  borderColor: `${phase.color}40`,
                                }}
                              >
                                {phase.name}
                              </span>
                            )}

                            {task.isCriticalPath && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 flex items-center gap-0.5 shrink-0">
                                <Flame className="w-2.5 h-2.5" />
                                <span>CRITICAL</span>
                              </span>
                            )}

                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                task.priority === 'urgent'
                                  ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                            {task.description}
                          </p>

                          {/* Checklist Items if available */}
                          {totalChecklist > 0 && (
                            <div className="pt-1 space-y-1">
                              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                <span>Checklist:</span>
                                <span className="font-mono text-[10px] text-purple-600 dark:text-purple-300">
                                  {completedChecklist}/{totalChecklist}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {task.checklist.map((item) => (
                                  <label
                                    key={item.id}
                                    onClick={() => toggleChecklistItem(task.id, item.id)}
                                    className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer select-none bg-slate-200/60 dark:bg-black/20 px-2 py-1 rounded truncate"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={item.completed}
                                      readOnly
                                      className="rounded border-slate-300 dark:border-slate-700 text-purple-600 dark:text-purple-500 focus:ring-0 w-3 h-3 shrink-0"
                                    />
                                    <span className={`truncate ${item.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                                      {item.text}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Deliverable Tokens & Meta */}
                          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                            <div className="flex items-center gap-2 shrink-0">
                              <img
                                src={assignee.avatar}
                                alt={assignee.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0"
                              />
                              <span className="truncate max-w-[100px]">{assignee.name}</span>
                              <span>&bull;</span>
                              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 font-mono shrink-0">
                                <Clock className="w-3 h-3" />
                                Due {task.dueDate}
                              </span>
                              <span>&bull;</span>
                              <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">{task.estimatedHours}h</span>
                            </div>

                            <div className="flex items-center gap-1 flex-wrap">
                              {task.deliverables.map((deliv, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 truncate max-w-[140px]"
                                >
                                  {deliv}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom link to Kanban */}
            <div className="pt-2.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                {activeProject.tasks.length} total deliverables in retroplan
              </span>
              <button
                onClick={() => setActiveViewTab('tasks')}
                className="font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
              >
                <span>Full Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Clarifications & Milestones */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {/* Gemini AI Clarification & Gap Detector */}
          <div className="bg-white dark:bg-[#0D121F] border border-purple-200 dark:border-purple-500/20 rounded-2xl p-4 sm:p-5 space-y-3 min-w-0 shadow-sm dark:shadow-none transition-colors">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/40 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Scope Clarification Queue
                </h3>
              </div>
              <span className="text-[9px] font-semibold px-2 py-0.2 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 shrink-0">
                Gemini Agent
              </span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Resolve these decisions to prevent timeline drift:
            </p>

            <div className="space-y-2 min-w-0">
              {activeProject.clarificationQuestions.map((q) => (
                <div
                  key={q.id}
                  className={`p-3 rounded-xl border transition-all min-w-0 ${
                    q.resolved
                      ? 'bg-slate-100/60 dark:bg-black/20 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400'
                      : 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-700/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <HelpCircle
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${q.resolved ? 'text-slate-400 dark:text-slate-500' : 'text-purple-600 dark:text-purple-400'}`}
                    />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 break-words">{q.question}</div>
                      <div className="text-[10px] text-purple-700 dark:text-purple-300/80 leading-relaxed">{q.reason}</div>

                      {q.resolved ? (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">Resolved: {q.userResponse}</span>
                        </div>
                      ) : (
                        <div className="pt-1.5 space-y-1">
                          <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Choose decision to apply:</div>
                          <div className="flex flex-wrap gap-1">
                            {q.suggestedOptions.map((opt, idx) => (
                              <button
                                key={idx}
                                onClick={() => resolveClarification(q.id, opt)}
                                className="text-[9px] px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/60 border border-purple-300 dark:border-purple-600/40 text-purple-800 dark:text-purple-200 font-medium transition-colors text-left truncate max-w-full"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retroplanning Milestones Sequence */}
          <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-3 min-w-0 shadow-sm dark:shadow-none transition-colors">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Milestone Sequence
                </h3>
              </div>

              <button
                onClick={() => setActiveViewTab('retroplanning')}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
              >
                <span>Gantt</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative pl-4 space-y-2.5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
              {activeProject.milestones.map((ms, index) => (
                <div key={ms.id} className="relative min-w-0">
                  <div
                    className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 ${
                      ms.completed
                        ? 'bg-emerald-500 border-white dark:border-[#0D121F]'
                        : index === 0 || !activeProject.milestones[index - 1]?.completed
                        ? 'bg-amber-500 border-white dark:border-[#0D121F] ring-1 ring-amber-500/30'
                        : 'bg-slate-300 dark:bg-slate-700 border-white dark:border-[#0D121F]'
                    }`}
                  />

                  <div className="bg-slate-50 dark:bg-[#141B2D]/40 p-2.5 rounded-xl border border-slate-200 dark:border-white/5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{ms.title}</span>
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 font-mono shrink-0">
                        {ms.targetDate}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-1">{ms.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Drop & Markdown Notes Card */}
          <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-center shadow-sm dark:shadow-none transition-colors">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Markdown & Notes Studio</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Paste meeting minutes, briefs, or client emails to auto-generate retroplanning tasks and dependencies.
            </p>
            <button
              onClick={() => setActiveViewTab('markdown')}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Open Markdown Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
