/**
 * Pointer-based move/resize for a bar. Pointer events (not mouse events) so a trackpad, a pen
 * and a touch screen all work; a movement threshold so a plain click never turns into a drag;
 * whole-day snapping via `deltaDaysFromPx`; Escape cancels without committing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { deltaDaysFromPx, moveInterval, resizeInterval, type DayInterval } from './scale';

/** What a drag does to the interval. */
export type DragMode = 'move' | 'resize-start' | 'resize-end';

/** The live, uncommitted interval of the bar being dragged. */
export interface DragPreview {
  id: string;
  mode: DragMode;
  interval: DayInterval;
}

/** Pointer travel (px) before a press becomes a drag. Below this it stays a click. */
export const DRAG_THRESHOLD_PX = 4;

interface DragState {
  id: string;
  mode: DragMode;
  base: DayInterval;
  interval: DayInterval;
  originX: number;
  pointerId: number;
  element: Element;
  active: boolean;
}

/** Handlers to spread on a draggable bar, plus the preview to render while dragging. */
export interface BarDrag {
  preview: DragPreview | null;
  /** Start a drag from a pointerdown on the bar (or on one of its edge handles). */
  start: (event: React.PointerEvent, id: string, mode: DragMode, interval: DayInterval) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: () => void;
  /**
   * True once, right after a drag ended — a click handler calls it first and bails out, so the
   * pointerup that ends a drag never also opens the inspector.
   */
  consumeClick: () => boolean;
}

export function useBarDrag(
  pxPerDay: number,
  onCommit: (id: string, interval: DayInterval) => void
): BarDrag {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const state = useRef<DragState | null>(null);
  const dragged = useRef(false);

  const release = useCallback(() => {
    const current = state.current;
    if (current && 'releasePointerCapture' in current.element) {
      try {
        (current.element as Element & { releasePointerCapture(id: number): void }).releasePointerCapture(
          current.pointerId
        );
      } catch {
        /* the pointer was already released */
      }
    }
    state.current = null;
    setPreview(null);
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      dragged.current = true; // the Escape keyup must not re-open the inspector either
      release();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [preview, release]);

  const start = useCallback(
    (event: React.PointerEvent, id: string, mode: DragMode, interval: DayInterval): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const element = event.currentTarget;
      dragged.current = false; // a fresh press: whatever the previous gesture was, it is over
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best effort */
      }
      state.current = {
        id,
        mode,
        base: interval,
        interval,
        originX: event.clientX,
        pointerId: event.pointerId,
        element,
        active: false,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent): void => {
      const current = state.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const dx = event.clientX - current.originX;
      if (!current.active) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        current.active = true;
      }
      const days = deltaDaysFromPx(dx, pxPerDay);
      const interval =
        current.mode === 'move'
          ? moveInterval(current.base, days)
          : resizeInterval(current.base, days, current.mode === 'resize-start' ? 'start' : 'end');
      current.interval = interval;
      setPreview({ id: current.id, mode: current.mode, interval });
    },
    [pxPerDay]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent): void => {
      const current = state.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const { active, id, interval, base } = current;
      release();
      if (!active) return;
      dragged.current = true;
      if (interval.start !== base.start || interval.end !== base.end) onCommit(id, interval);
    },
    [onCommit, release]
  );

  const consumeClick = useCallback((): boolean => {
    if (!dragged.current) return false;
    dragged.current = false;
    return true;
  }, []);

  return { preview, start, onPointerMove, onPointerUp, onPointerCancel: release, consumeClick };
}
