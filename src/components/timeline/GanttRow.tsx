import React from 'react';
import { Flame, Lock } from 'lucide-react';
import type { Phase, Task } from '../../types';
import type { GanttRow as ModelRow } from '../../services/export/gantt';
import { barGeometry, formatDayRange, type DayInterval } from './scale';
import type { TimelineRow } from './layout';
import type { BarDrag } from './useBarDrag';
import type { TimelineView } from './useTimelineScale';
import { TASK_STATUS_LABELS } from '../taskFields';

/** Width of the invisible grab strip at each end of a bar. */
const HANDLE_PX = 8;
/** Below this width the two handles would cover the whole bar, so only moving stays available. */
const MIN_WIDTH_FOR_HANDLES = 3 * HANDLE_PX;

/** Live date chip shown above a bar while it is being dragged or resized. */
const DragTooltip: React.FC<{ interval: DayInterval; locale: string }> = ({ interval, locale }) => (
  <span className="absolute -top-6 left-0 z-30 whitespace-nowrap rounded-md border border-line-strong bg-card px-1.5 py-0.5 font-mono text-[10px] text-fg shadow-lg">
    {formatDayRange(interval.start, interval.end, locale)}
  </span>
);

export interface PhaseBarProps {
  row: TimelineRow;
  modelRow: ModelRow;
  phase: Phase | null;
  view: TimelineView;
  drag: BarDrag;
}

/** The band spanning a whole phase; draggable and resizable through `updatePhaseDates`. */
export const PhaseBar: React.FC<PhaseBarProps> = ({ row, modelRow, phase, view, drag }) => {
  const dragging = drag.preview?.id === modelRow.id;
  const interval: DayInterval = dragging
    ? (drag.preview as { interval: DayInterval }).interval
    : { start: modelRow.start, end: modelRow.end };
  const geometry = barGeometry(interval.start, interval.end, view.model.from, view.pxPerDay);
  if (!geometry) return null;

  const label = `${modelRow.label}, ${formatDayRange(interval.start, interval.end, view.locale)}`;
  const editable = Boolean(phase);
  const showHandles = editable && geometry.width >= MIN_WIDTH_FOR_HANDLES;

  return (
    <div
      className="absolute rounded-lg border-2 border-dashed"
      style={{
        left: geometry.left,
        width: geometry.width,
        top: row.top + 6,
        height: row.height - 12,
        backgroundColor: `${modelRow.color}22`,
        borderColor: `${modelRow.color}80`,
      }}
    >
      {dragging && <DragTooltip interval={interval} locale={view.locale} />}
      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center gap-2 overflow-hidden whitespace-nowrap font-mono text-[10px] text-fg-muted">
        {formatDayRange(interval.start, interval.end, view.locale)}
      </span>
      {editable && (
        <button
          type="button"
          aria-label={`Move phase ${label}`}
          className="absolute inset-0 cursor-grab rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          onPointerDown={(e) => drag.start(e, modelRow.id, 'move', { start: modelRow.start, end: modelRow.end })}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
        />
      )}
      {showHandles && (
        <>
          <button
            type="button"
            aria-label={`Resize start of phase ${modelRow.label}`}
            className="absolute inset-y-0 left-0 cursor-ew-resize rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            style={{ width: HANDLE_PX }}
            onPointerDown={(e) =>
              drag.start(e, modelRow.id, 'resize-start', { start: modelRow.start, end: modelRow.end })
            }
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerCancel={drag.onPointerCancel}
          />
          <button
            type="button"
            aria-label={`Resize end of phase ${modelRow.label}`}
            className="absolute inset-y-0 right-0 cursor-ew-resize rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            style={{ width: HANDLE_PX }}
            onPointerDown={(e) =>
              drag.start(e, modelRow.id, 'resize-end', { start: modelRow.start, end: modelRow.end })
            }
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerCancel={drag.onPointerCancel}
          />
        </>
      )}
    </div>
  );
};

export interface TaskBarProps {
  row: TimelineRow;
  modelRow: ModelRow;
  task: Task;
  view: TimelineView;
  drag: BarDrag;
  selected: boolean;
  hovered: boolean;
  onComputedCritical: boolean;
  highlightCritical: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onNudge: (task: Task, days: number, mode: 'move' | 'resize-end') => void;
}

/** One task bar: click to inspect, drag to move, edge handles to resize, arrows to nudge. */
export const TaskBar: React.FC<TaskBarProps> = ({
  row,
  modelRow,
  task,
  view,
  drag,
  selected,
  hovered,
  onComputedCritical,
  highlightCritical,
  onHover,
  onSelect,
  onOpen,
  onNudge,
}) => {
  const dragging = drag.preview?.id === task.id;
  const interval: DayInterval = dragging
    ? (drag.preview as { interval: DayInterval }).interval
    : { start: modelRow.start, end: modelRow.end };
  const geometry = barGeometry(interval.start, interval.end, view.model.from, view.pxPerDay);
  if (!geometry) return null;

  const manualFlag = task.isCriticalPath === true;
  const critical = highlightCritical && onComputedCritical;
  const done = task.status === 'done';
  const tone = done
    ? 'bg-emerald-500/20 dark:bg-emerald-500/25 border-emerald-500/60'
    : critical
    ? 'bg-rose-500/20 dark:bg-rose-500/25 border-rose-500'
    : 'bg-elevated border-line-strong';
  const emphasis = selected
    ? 'ring-2 ring-purple-500'
    : hovered
    ? 'ring-1 ring-purple-400'
    : '';

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(task.id);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const days = event.key === 'ArrowLeft' ? -1 : 1;
    onNudge(task, days, event.shiftKey ? 'resize-end' : 'move');
  };

  const dates = formatDayRange(interval.start, interval.end, view.locale);
  const statusLabel = TASK_STATUS_LABELS[task.status];
  const showHandles = geometry.width >= MIN_WIDTH_FOR_HANDLES;

  return (
    <div
      className="absolute"
      style={{ left: geometry.left, width: geometry.width, top: row.top + 2, height: row.height - 4 }}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
    >
      {dragging && <DragTooltip interval={interval} locale={view.locale} />}
      <button
        type="button"
        aria-label={`${task.title}, ${dates}, ${statusLabel}${critical ? ', on the computed critical path' : ''}`}
        title={`${task.title} — ${dates} — ${statusLabel}`}
        onKeyDown={handleKeyDown}
        onFocus={() => onSelect(task.id)}
        onClick={() => {
          if (drag.consumeClick()) return;
          onOpen(task.id);
        }}
        onPointerDown={(e) => drag.start(e, task.id, 'move', { start: modelRow.start, end: modelRow.end })}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        className={`flex h-full w-full cursor-grab items-center gap-1 overflow-hidden rounded-md border px-1.5 text-left text-[11px] font-medium text-fg shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${tone} ${emphasis}`}
        style={{ borderLeftColor: modelRow.color, borderLeftWidth: 3 }}
      >
        {critical && <Flame className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400" />}
        {manualFlag && !critical && <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />}
        <span className="truncate">{task.title}</span>
      </button>
      {showHandles && (
        <>
          <span
            role="presentation"
            className="absolute inset-y-0 left-0 cursor-ew-resize"
            style={{ width: HANDLE_PX }}
            onPointerDown={(e) => drag.start(e, task.id, 'resize-start', { start: modelRow.start, end: modelRow.end })}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerCancel={drag.onPointerCancel}
          />
          <span
            role="presentation"
            className="absolute inset-y-0 right-0 cursor-ew-resize"
            style={{ width: HANDLE_PX }}
            onPointerDown={(e) => drag.start(e, task.id, 'resize-end', { start: modelRow.start, end: modelRow.end })}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerCancel={drag.onPointerCancel}
          />
        </>
      )}
    </div>
  );
};

export interface RowLabelProps {
  row: TimelineRow;
  view: TimelineView;
  phase: Phase | null;
  groupLabel: string;
  color: string;
}

/** The frozen left-hand label of a row. */
export const RowLabel: React.FC<RowLabelProps> = ({ row, view, phase, groupLabel, color }) => {
  const style: React.CSSProperties = { top: row.top, height: row.height };
  if (row.kind === 'phase') {
    const buffer = phase && Number.isFinite(phase.bufferDays) ? phase.bufferDays : null;
    return (
      <div className="absolute inset-x-0 flex items-center gap-2 px-3" style={style}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-xs font-bold text-fg">{groupLabel}</span>
        {buffer !== null && buffer > 0 && (
          <span className="shrink-0 rounded bg-elevated px-1 font-mono text-[10px] text-fg-muted">
            +{buffer}d buffer
          </span>
        )}
      </div>
    );
  }
  const names = row.taskIds
    .map((id) => view.taskById.get(id)?.title)
    .filter((t): t is string => Boolean(t));
  return (
    <div className="absolute inset-x-0 flex items-center gap-2 pl-7 pr-3" style={style}>
      <span className="truncate text-[11px] text-fg-muted" title={names.join(' · ')}>
        {names.length === 1 ? names[0] : `${names.length} tasks`}
      </span>
    </div>
  );
};
