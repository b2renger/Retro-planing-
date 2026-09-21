import React, { useState } from 'react';
import { BarChart3, Filter, Flame, Layers, Plus, Sparkles, Target } from 'lucide-react';
import type { Project, User } from '../../types';
import { parseDay } from '../../services/export/common';
import { TargetDateControl, type TargetDateMode } from './TargetDateControl';
import { ZOOM_LABELS, type TimelineZoom } from './scale';
import type { TimelineFilters } from './useTimelineScale';

/** The three graphic modes of the retroplanning tab. */
export type TimelineMode = 'gantt' | 'runway' | 'workload';

export interface TimelineToolbarProps {
  project: Project;
  teamMembers: readonly User[];
  mode: TimelineMode;
  onModeChange: (mode: TimelineMode) => void;
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
  highlightCritical: boolean;
  onToggleCritical: () => void;
  criticalCount: number;
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  onApplyTargetDate: (date: string, mode: TargetDateMode) => void;
  onAddMilestone: (title: string, date: string) => void;
  onRunAi: () => void;
  isOptimizing: boolean;
}

const MODES: { id: TimelineMode; label: string; icon: React.ReactNode }[] = [
  { id: 'gantt', label: 'Gantt chart', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'runway', label: 'Milestone runway', icon: <Target className="h-3.5 w-3.5" /> },
  { id: 'workload', label: 'Workload curve', icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

/**
 * Header controls: the delivery anchor, the critical-path toggle, the three modes, zoom, filters
 * and the milestone form.
 *
 * Deliberately no health figures. Target delivery, slack, flagged critical and tasks done are in
 * `ProjectHeader`, which is on screen on every tab; a second copy of them here only made the user
 * read the same four numbers twice, stacked.
 */
export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
  project,
  teamMembers,
  mode,
  onModeChange,
  zoom,
  onZoomChange,
  highlightCritical,
  onToggleCritical,
  criticalCount,
  filters,
  onFiltersChange,
  onApplyTargetDate,
  onAddMilestone,
  onRunAi,
  isOptimizing,
}) => {
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const submitMilestone = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!title.trim() || !parseDay(date)) return;
    onAddMilestone(title.trim(), date);
    setTitle('');
    setDate('');
    setShowMilestoneForm(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm dark:shadow-xl sm:p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <TargetDateControl targetDate={project.targetDeliveryDate} onApply={onApplyTargetDate} />

          <button
            type="button"
            id="toggle-critical-path-btn"
            onClick={onToggleCritical}
            aria-pressed={highlightCritical}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
              highlightCritical
                ? 'border-rose-500/40 bg-rose-500/20 text-rose-700 dark:text-rose-300'
                : 'border-line bg-elevated text-fg-muted hover:text-fg'
            }`}
            title="Highlight the critical path computed from dependencies and estimated hours"
          >
            <Flame className={`h-3.5 w-3.5 ${highlightCritical ? 'text-rose-600 dark:text-rose-400' : ''}`} />
            <span>
              Critical path {highlightCritical ? 'on' : 'off'}
              {criticalCount > 0 ? ` (${criticalCount})` : ''}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-line bg-elevated p-1 text-xs">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                id={`mode-${m.id}-btn`}
                onClick={() => onModeChange(m.id)}
                aria-pressed={mode === m.id}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                  mode === m.id ? 'bg-purple-600 text-white' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            id="ai-retroplan-optimizer-btn"
            onClick={onRunAi}
            disabled={isOptimizing}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500 disabled:opacity-50"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Analysing…' : 'AI dependency analysis'}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-fg-muted">
            <Filter className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            Filters
          </span>
          <select
            aria-label="Filter by phase"
            value={filters.phaseId}
            onChange={(e) => onFiltersChange({ ...filters, phaseId: e.target.value })}
            className="rounded-lg border border-line bg-input px-2.5 py-1 text-xs text-fg focus:outline-none"
          >
            <option value="all">All phases ({project.phases.length})</option>
            {project.phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by assignee"
            value={filters.assigneeId}
            onChange={(e) => onFiltersChange({ ...filters, assigneeId: e.target.value })}
            className="rounded-lg border border-line bg-input px-2.5 py-1 text-xs text-fg focus:outline-none"
          >
            <option value="all">All assignees ({teamMembers.length})</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {(filters.phaseId !== 'all' || filters.assigneeId !== 'all') && (
            <button
              type="button"
              onClick={() => onFiltersChange({ phaseId: 'all', assigneeId: 'all' })}
              className="text-[11px] font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-lg border border-line bg-elevated p-0.5 text-[11px]"
            role="group"
            aria-label="Timeline zoom"
          >
            {(Object.keys(ZOOM_LABELS) as TimelineZoom[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => onZoomChange(z)}
                aria-pressed={zoom === z}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  zoom === z ? 'bg-purple-600 font-semibold text-white' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {ZOOM_LABELS[z]}
              </button>
            ))}
          </div>

          <button
            type="button"
            id="toggle-add-milestone-btn"
            onClick={() => setShowMilestoneForm((v) => !v)}
            aria-expanded={showMilestoneForm}
            className="flex items-center gap-1 rounded-lg border border-line bg-elevated px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:bg-line"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Milestone</span>
          </button>
        </div>
      </div>

      {showMilestoneForm && (
        <form onSubmit={submitMilestone} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
          <input
            type="text"
            aria-label="Milestone title"
            placeholder="Milestone title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-line bg-input px-3 py-1.5 text-fg placeholder-fg-subtle focus:border-purple-500 focus:outline-none"
          />
          <input
            type="date"
            aria-label="Milestone date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-line bg-input px-3 py-1.5 text-fg focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!title.trim() || !parseDay(date)}
            className="rounded-xl bg-purple-600 px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
          >
            Save milestone
          </button>
          <button type="button" onClick={() => setShowMilestoneForm(false)} className="px-2.5 py-1.5 text-fg-muted hover:text-fg">
            Cancel
          </button>
        </form>
      )}
    </div>
  );
};
