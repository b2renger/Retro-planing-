/**
 * Follows a real element by CSS selector.
 *
 * There is no anchor registry: steps target an existing `id` or a `data-tour="…"` attribute added
 * to the component itself, which keeps the change to those components to one attribute. The rect is
 * re-read on scroll, resize, and whenever the DOM changes (a view switch, a modal opening), so the
 * coachmark stays on its target and reports `null` when the element is gone or invisible.
 */
import { useEffect, useState } from 'react';
import type { Rect, Size } from './placement';

function rectOf(el: Element): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** First match with a real size — desktop and mobile variants can share one `data-tour`. */
function firstRendered(selector: string): Element | null {
  let nodes: NodeListOf<Element>;
  try {
    nodes = document.querySelectorAll(selector);
  } catch {
    return null; // a malformed selector must never break the app
  }
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

export interface AnchorState {
  rect: Rect | null;
  viewport: Size;
}

/** `null` selector (or `enabled: false`) parks the hook without touching the DOM. */
export function useAnchor(selector: string | null, enabled: boolean): AnchorState {
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState<Size>(() =>
    typeof window === 'undefined' ? { width: 1024, height: 768 } : { width: window.innerWidth, height: window.innerHeight }
  );

  useEffect(() => {
    if (!enabled || !selector || typeof window === 'undefined') {
      setRect(null);
      return;
    }

    let frame = 0;
    let current: Rect | null = null;

    const measure = (): void => {
      frame = 0;
      const el = firstRendered(selector);
      const next = el ? rectOf(el) : null;
      if (!sameRect(current, next)) {
        current = next;
        setRect(next);
      }
      setViewport((v) => (v.width === window.innerWidth && v.height === window.innerHeight ? v : { width: window.innerWidth, height: window.innerHeight }));
    };

    const schedule = (): void => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    // Cheap safety net for layout changes nothing else reports (fonts, images, CSS transitions).
    const timer = window.setInterval(measure, 500);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [selector, enabled]);

  return { rect, viewport };
}

/** Scrolls the anchor into view once per step, when it exists and is off screen. */
export function scrollAnchorIntoView(selector: string): void {
  if (typeof document === 'undefined') return;
  const el = firstRendered(selector);
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top >= 0 && r.bottom <= window.innerHeight) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center', inline: 'center' });
}
