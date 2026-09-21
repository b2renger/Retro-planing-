import React from 'react';

/**
 * Closes a popover on Escape or on a pointer press outside it. Every dropdown in the navbar uses
 * it, so none of them can be left open behind the next thing the user clicks.
 */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, onDismiss: () => void, active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    const onPointer = (event: PointerEvent): void => {
      const node = ref.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) onDismiss();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [ref, onDismiss, active]);
}
