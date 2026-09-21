import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { computeProjectHealth, useActiveProject, useApp } from '../context/AppContext';
import type { Task, TaskStatus } from '../types';
import { analyzeDependencies, type DependencyOutcome } from '../services/ai/tasks';
import { AiAnalysisPanel } from './AiAnalysisPanel';
import { PHASE_PALETTE } from './taskFields';
import { GanttChart } from './timeline/GanttChart';
import { MilestoneRunway } from './timeline/MilestoneRunway';
import { TaskInspector } from './timeline/TaskInspector';
import { TimelineEmptyState, WarningStrip } from './timeline/TimelineNotices';
import { TimelineToolbar, type TimelineMode } from './timeline/TimelineToolbar';
import { WorkloadCurve } from './timeline/WorkloadCurve';
import type { TargetDateMode } from './timeline/TargetDateControl';
import type { DayInterval, TimelineZoom } from './timeline/scale';
import { useTimelineScale, type TimelineFilters } from './timeline/useTimelineScale';

/**
 * The retroplanning tab: a real scheduling instrument. Geometry, lane packing, dependency
 * arrows and the critical path all come from the shared pure modules; this container only
 * holds view state and routes every write through the state facade.
 */
export const RetroplanningTimeline: React.FC = () => {
  const {
    teamMembers,
    updateTask,
    updateTaskStatus,
    toggleChecklistItem,
    setEditingTaskId,
    addPhase,
    updatePhaseDates,
    addMilestone,
    updateMilestone,
    toggleMilestoneComplete,
    updateTargetDeliveryDate,
    setActiveViewTab,
    addNotification,
    setIsSettingsOpen,
    activeAiProvider,
    undo,
    canUndo,
    undoLabel,
  } = useApp();
  const project = useActiveProject();

  const [mode, setMode] = useState<TimelineMode>('gantt');
  const [zoom, setZoom] = useState<TimelineZoom>('week');
  const [filters, setFilters] = useState<TimelineFilters>({ phaseId: 'all', assigneeId: 'all' });
  const [highlightCritical, setHighlightCritical] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState('');
  const [analysis, setAnalysis] = useState<DependencyOutcome | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const view = useTimelineScale(project, teamMembers, zoom, filters);
  const health = useMemo(() => computeProjectHealth(project), [project]);
  const warningKey = view.warnings.join('|');
  const warnings = dismissedWarnings === warningKey ? [] : view.warnings;

  const commitTaskInterval = (task: Task, interval: DayInterval): void => {
    updateTask({ ...task, startDate: interval.start, dueDate: interval.end });
  };

  const runAiAnalysis = async (): Promise<void> => {
    setIsOptimizing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeDependencies(
        {
          tasks: project.tasks,
          targetDeliveryDate: project.targetDeliveryDate,
          projectName: project.title,
        },
        activeAiProvider
      );
      setAnalysis(result);
      addNotification({
        title: result.fallback ? 'Analysed locally — no AI provider answered' : `Analysed by ${result.source}`,
        message: result.analysis.executiveSummary || `${result.analysis.bottlenecks.length} bottleneck(s) reported.`,
        type: 'ai_insight',
        projectId: project.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAnalysis(null);
      setAnalysisError(message);
      addNotification({
        title: 'Dependency analysis failed',
        message,
        type: 'status_update',
        projectId: project.id,
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="animate-fadeIn mx-auto w-full max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      <TimelineToolbar
        project={project}
        teamMembers={teamMembers}
        mode={mode}
        onModeChange={setMode}
        zoom={zoom}
        onZoomChange={setZoom}
        highlightCritical={highlightCritical}
        onToggleCritical={() => setHighlightCritical((v) => !v)}
        criticalCount={view.criticalIds.size}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyTargetDate={(date: string, targetMode: TargetDateMode) =>
          updateTargetDeliveryDate(date, targetMode)
        }
        onAddMilestone={(title, date) =>
          addMilestone({
            title,
            targetDate: date,
            isHardDeadline: true,
            completed: false,
            description: '',
            deliverableCount: 0,
          })
        }
        onRunAi={runAiAnalysis}
        isOptimizing={isOptimizing}
      />

      {canUndo && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={undo}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo {undoLabel}
          </button>
        </div>
      )}

      <WarningStrip warnings={warnings} onDismiss={() => setDismissedWarnings(warningKey)} />

      {analysisError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300"
        >
          The dependency analysis failed: {analysisError}
        </div>
      )}

      {analysis && (
        <AiAnalysisPanel
          outcome={analysis}
          tasks={project.tasks}
          onDismiss={() => setAnalysis(null)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {mode === 'gantt' &&
        (view.isEmpty ? (
          <TimelineEmptyState
            project={project}
            onCreatePhase={(name, startDate, endDate) =>
              addPhase({
                name,
                startDate,
                endDate,
                color: PHASE_PALETTE[project.phases.length % PHASE_PALETTE.length],
                order: project.phases.length + 1,
                bufferDays: 0,
                isCriticalPath: false,
              })
            }
            onOpenCrunch={() => setActiveViewTab('markdown')}
          />
        ) : (
          <GanttChart
            view={view}
            phases={project.phases}
            highlightCritical={highlightCritical}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onOpenTask={(id) => {
              setSelectedTaskId(id);
              setInspectorId(id);
            }}
            onTaskInterval={commitTaskInterval}
            onPhaseInterval={(phaseId, interval) => updatePhaseDates(phaseId, interval.start, interval.end)}
            onToggleMilestone={toggleMilestoneComplete}
          />
        ))}

      {mode === 'runway' && (
        <MilestoneRunway
          project={project}
          health={health}
          locale={view.locale}
          today={view.model.today}
          onToggle={toggleMilestoneComplete}
          onReschedule={(id, date) => updateMilestone(id, { targetDate: date })}
        />
      )}

      {mode === 'workload' && <WorkloadCurve project={project} teamMembers={teamMembers} />}

      <TaskInspector
        project={project}
        taskId={inspectorId}
        teamMembers={teamMembers}
        locale={view.locale}
        criticalIds={view.criticalIds}
        onClose={() => setInspectorId(null)}
        onStatusChange={(taskId: string, status: TaskStatus) => updateTaskStatus(taskId, status)}
        onToggleChecklistItem={toggleChecklistItem}
        onEdit={(taskId) => {
          setInspectorId(null);
          setEditingTaskId(taskId);
        }}
      />
    </div>
  );
};
