import React, { useMemo, useState } from 'react';
import { Flag, Flame, Lock } from 'lucide-react';
import type { Phase, Task } from '../../types';
import { rowCenterY } from './layout';
import { barGeometry, formatDay, moveInterval, resizeInterval, type DayInterval } from './scale';
import { PhaseBar, RowLabel, TaskBar } from './GanttRow';
import { useBarDrag } from './useBarDrag';
import type { TimelineView } from './useTimelineScale';

/** Width of the frozen label column. */
const LABEL_WIDTH = 224;
/** Height of one milestone chip row. */
const FLAG_ROW_HEIGHT = 22;
/** Padding under the milestone strip, also used when there is no milestone at all. */
const FLAG_STRIP_PADDING = 8;

/** Height of the milestone strip for a given number of stacked levels. */
const stripHeight = (levels: number): number =>
  levels === 0 ? FLAG_STRIP_PADDING : levels * FLAG_ROW_HEIGHT + FLAG_STRIP_PADDING;

export interface GanttChartProps {
  view: TimelineView;
  phases: readonly Phase[];
  highlightCritical: boolean;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onOpenTask: (id: string) => void;
  onTaskInterval: (task: Task, interval: DayInterval) => void;
  onPhaseInterval: (phaseId: string, interval: DayInterval) => void;
  onToggleMilestone: (id: string) => void;
}

/** Dependency arrows, drawn beneath the bars in the same coordinate space. */
const DependencyLayer: React.FC<{ view: TimelineView; activeId: string | null }> = ({ view, activeId }) => {
  const paths = useMemo(() => {
    const out: { key: string; d: string; head: string; violation: boolean; active: boolean; label: string }[] = [];
    for (const link of view.links) {
      const predRow = view.rowOfTask.get(link.predecessorId);
      const succRow = view.rowOfTask.get(link.successorId);
      const pred = view.taskRowById.get(link.predecessorId);
      const succ = view.taskRowById.get(link.successorId);
      if (!predRow || !succRow || !pred || !succ) continue;
      const a = barGeometry(pred.start, pred.end, view.model.from, view.pxPerDay);
      const b = barGeometry(succ.start, succ.end, view.model.from, view.pxPerDay);
      if (!a || !b) continue;
      const x1 = a.left + a.width;
      const y1 = rowCenterY(predRow);
      const x2 = b.left;
      const y2 = rowCenterY(succRow);
      const midX = Math.max(x1 + 8, x2 - 10);
      out.push({
        key: `${link.predecessorId}->${link.successorId}`,
        d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
        head: `M ${x2 - 5} ${y2 - 3.5} L ${x2} ${y2} L ${x2 - 5} ${y2 + 3.5} Z`,
        violation: link.violation,
        active: activeId === link.predecessorId || activeId === link.successorId,
        label: link.violation
          ? `${pred.label} ends after ${succ.label} starts — this dependency cannot be met as scheduled`
          : `${pred.label} must finish before ${succ.label} starts`,
      });
    }
    return out;
  }, [view, activeId]);

  if (paths.length === 0) return null;
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-0"
      width={view.width}
      height={view.bodyHeight}
      aria-hidden="true"
    >
      {paths.map((p) => (
        <g
          key={p.key}
          className={p.violation ? 'text-rose-500' : p.active ? 'text-purple-500' : 'text-fg-subtle'}
          opacity={p.violation || p.active ? 1 : 0.55}
        >
          <title>{p.label}</title>
          <path
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.active || p.violation ? 2 : 1.25}
            strokeDasharray={p.violation ? '4 3' : undefined}
          />
          <path d={p.head} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
};

/** The milestone flag strip: staggered chips, with a "+N" when a level runs out. */
const MilestoneStrip: React.FC<{
  view: TimelineView;
  levels: number;
  onToggle: (id: string) => void;
}> = ({ view, levels, onToggle }) => {
  if (levels === 0) return <div style={{ height: stripHeight(0) }} />;
  return (
    <div className="relative" style={{ height: stripHeight(levels), width: view.width }}>
      {view.flags.map((flag) => {
        const extra = flag.collapsed.length;
        const names = [flag.milestone, ...flag.collapsed]
          .map((m) => `${m.title} (${formatDay(m.targetDate, view.locale, { day: 'numeric', month: 'short' })})`)
          .join(' · ');
        return (
          <button
            key={flag.id}
            type="button"
            onClick={() => onToggle(flag.id)}
            title={`${names} — click to toggle completion`}
            className={`absolute flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              flag.milestone.completed
                ? 'border-emerald-400 bg-emerald-600 text-white'
                : 'border-amber-200 bg-amber-400 text-slate-950'
            }`}
            style={{ left: flag.x, top: flag.level * FLAG_ROW_HEIGHT }}
          >
            <Flag className="h-2.5 w-2.5 shrink-0" />
            <span className="max-w-[140px] truncate">{flag.milestone.title}</span>
            {extra > 0 && <span className="shrink-0 font-mono">+{extra}</span>}
          </button>
        );
      })}
    </div>
  );
};

/**
 * The Gantt: a frozen label column plus a horizontally scrolling grid whose geometry is a real
 * pixels-per-day scale. Rows come from lane packing, so no task can hide another.
 */
export const GanttChart: React.FC<GanttChartProps> = ({
  view,
  phases,
  highlightCritical,
  selectedTaskId,
  onSelectTask,
  onOpenTask,
  onTaskInterval,
  onPhaseInterval,
  onToggleMilestone,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const phaseById = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);
  // The frozen column and the grid must start their rows at the same y, so both offset the
  // rows by the axis height plus the milestone strip.
  const flagLevels = view.flags.reduce((max, flag) => Math.max(max, flag.level + 1), 0);

  const taskDrag = useBarDrag(view.pxPerDay, (id, interval) => {
    const task = view.taskById.get(id);
    if (task) onTaskInterval(task, interval);
  });
  const phaseDrag = useBarDrag(view.pxPerDay, (id, interval) => onPhaseInterval(id, interval));

  const nudge = (task: Task, days: number, mode: 'move' | 'resize-end'): void => {
    const base: DayInterval = { start: task.startDate, end: task.dueDate };
    const next = mode === 'move' ? moveInterval(base, days) : resizeInterval(base, days, 'end');
    if (next.start === base.start && next.end === base.end) return;
    onTaskInterval(task, next);
  };

  const activeId = taskDrag.preview?.id ?? selectedTaskId ?? hoveredId;

  return (
    <div className="flex overflow-hidden rounded-2xl border border-line bg-card shadow-sm dark:shadow-xl">
      {/* Frozen labels */}
      <div className="shrink-0 border-r border-line bg-card" style={{ width: LABEL_WIDTH }}>
        <div className="flex h-9 items-center border-b border-line px-3 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
          Phases &amp; lanes
        </div>
        <div style={{ height: stripHeight(flagLevels) }} />
        <div className="relative" style={{ height: Math.max(view.bodyHeight, 48) }}>
          {view.rows.map((row) => {
            const group = view.groups.find((g) => g.id === row.phaseId);
            return (
              <RowLabel
                key={row.id}
                row={row}
                view={view}
                phase={phaseById.get(row.phaseId) ?? null}
                groupLabel={group?.label ?? row.phaseId}
                color={group?.color ?? 'transparent'}
              />
            );
          })}
        </div>
      </div>

      {/* Scrolling grid */}
      <div className="flex-1 overflow-x-auto">
        <div style={{ width: view.width, minWidth: '100%' }}>
          {/* Axis */}
          <div className="relative h-9 border-b border-line">
            {view.ticks.map((tick) => (
              <div
                key={tick.key}
                className={`absolute top-0 h-full border-l border-line ${
                  tick.isWeekend && view.zoom === 'day' ? 'bg-elevated/60' : ''
                }`}
                style={{ left: tick.x, width: view.pxPerDay }}
              >
                <span className="block whitespace-nowrap px-1 pt-2 font-mono text-[10px] text-fg-muted">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>

          <MilestoneStrip view={view} levels={flagLevels} onToggle={onToggleMilestone} />

          {/* Body */}
          <div className="relative" style={{ height: Math.max(view.bodyHeight, 48), width: view.width }}>
            {view.ticks.map((tick) => (
              <div
                key={`grid-${tick.key}`}
                className={`absolute top-0 h-full border-l border-line ${
                  tick.isWeekend && view.zoom === 'day' ? 'bg-elevated/50' : ''
                }`}
                style={{ left: tick.x, width: view.pxPerDay }}
              />
            ))}
            {view.todayX !== null && (
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-purple-500"
                style={{ left: view.todayX }}
                title="Today"
              />
            )}
            {view.targetX !== null && (
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-amber-500"
                style={{ left: view.targetX }}
                title={`Target delivery ${view.model.target ?? ''}`}
              />
            )}

            <DependencyLayer view={view} activeId={activeId} />

            {view.rows.length === 0 && (
              <p className="absolute left-4 top-4 text-xs text-fg-muted">
                No phase or task matches the current filters.
              </p>
            )}

            {view.rows.map((row) => {
              if (row.kind === 'phase') {
                const group = view.groups.find((g) => g.id === row.phaseId);
                if (!group?.phaseRow) return null;
                return (
                  <PhaseBar
                    key={row.id}
                    row={row}
                    modelRow={group.phaseRow}
                    phase={phaseById.get(row.phaseId) ?? null}
                    view={view}
                    drag={phaseDrag}
                  />
                );
              }
              return row.taskIds.map((taskId) => {
                const modelRow = view.taskRowById.get(taskId);
                const task = view.taskById.get(taskId);
                if (!modelRow || !task) return null;
                return (
                  <TaskBar
                    key={taskId}
                    row={row}
                    modelRow={modelRow}
                    task={task}
                    view={view}
                    drag={taskDrag}
                    selected={selectedTaskId === taskId}
                    hovered={hoveredId === taskId}
                    onComputedCritical={view.criticalIds.has(taskId)}
                    highlightCritical={highlightCritical}
                    onHover={setHoveredId}
                    onSelect={onSelectTask}
                    onOpen={onOpenTask}
                    onNudge={nudge}
                  />
                );
              });
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-3 py-2.5 text-[11px] text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Flame className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              Critical path — computed from dependencies and estimated hours
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              Manually flagged on the task
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-emerald-500/70" />
              Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-amber-400" />
              Milestone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-rose-500" />
              Dependency that cannot be met as scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-purple-500" />
              Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-amber-500" />
              Target delivery
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
