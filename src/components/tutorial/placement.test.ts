import { describe, expect, it } from 'vitest';
import { computePlacement, spotlightPanels, type Rect } from './placement';

const viewport = { width: 1000, height: 800 };
const card = { width: 380, height: 260 };
const anchor = (over: Partial<Rect> = {}): Rect => ({ top: 300, left: 400, width: 120, height: 40, ...over });

describe('computePlacement', () => {
  it('uses the preferred side when it fits and centres the card on the anchor', () => {
    const r = computePlacement({ anchor: anchor(), card, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('bottom');
    expect(r.fallback).toBe(false);
    expect(r.top).toBe(300 + 40 + 12);
    expect(r.left).toBe(Math.round(400 + 60 - 190));
  });

  it('flips bottom to top when there is no room below', () => {
    const r = computePlacement({ anchor: anchor({ top: 700 }), card, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('top');
    expect(r.top).toBe(700 - 12 - 260);
  });

  it('flips top to bottom when there is no room above', () => {
    const r = computePlacement({ anchor: anchor({ top: 20 }), card, viewport, preferred: 'top' });
    expect(r.placement).toBe('bottom');
    expect(r.top).toBe(20 + 40 + 12);
  });

  it('flips left to right when the anchor hugs the left edge', () => {
    const r = computePlacement({ anchor: anchor({ left: 10 }), card, viewport, preferred: 'left' });
    expect(r.placement).toBe('right');
    expect(r.left).toBe(10 + 120 + 12);
  });

  it('tries the other sides when neither the preferred one nor its opposite fits', () => {
    // Tall anchor: no room above or below, but plenty to the right.
    const r = computePlacement({ anchor: { top: 40, left: 100, width: 60, height: 700 }, card, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('right');
    expect(r.left).toBe(100 + 60 + 12);
  });

  it('clamps the card inside the viewport instead of hanging off an edge', () => {
    const right = computePlacement({ anchor: anchor({ left: 960, width: 30 }), card, viewport, preferred: 'bottom' });
    expect(right.left).toBe(viewport.width - card.width - 12);
    const left = computePlacement({ anchor: anchor({ left: 0, width: 30 }), card, viewport, preferred: 'bottom' });
    expect(left.left).toBe(12);
  });

  it('centres the card when there is no anchor, and reports the fallback', () => {
    const r = computePlacement({ anchor: null, card, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('center');
    expect(r.fallback).toBe(true);
    expect(r.top).toBe(Math.round((800 - 260) / 2));
    expect(r.left).toBe(Math.round((1000 - 380) / 2));
  });

  it('centres the card when the anchor is collapsed to zero size', () => {
    expect(computePlacement({ anchor: anchor({ width: 0, height: 0 }), card, viewport, preferred: 'right' }).fallback).toBe(true);
  });

  it('centres without calling it a fallback when the step asked for the centre', () => {
    const r = computePlacement({ anchor: anchor(), card, viewport, preferred: 'center' });
    expect(r.placement).toBe('center');
    expect(r.fallback).toBe(false);
  });

  it('centres when the card cannot fit on any side of a viewport-filling anchor', () => {
    const r = computePlacement({ anchor: { top: 5, left: 5, width: 990, height: 790 }, card, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('center');
    expect(r.fallback).toBe(true);
  });
});

describe('spotlightPanels', () => {
  it('leaves a padded hole around the anchor and covers the rest', () => {
    const panels = spotlightPanels(anchor(), viewport, 6);
    expect(panels).toHaveLength(4);
    const covered = panels.reduce((n, p) => n + p.width * p.height, 0);
    const hole = (120 + 12) * (40 + 12);
    expect(covered).toBe(viewport.width * viewport.height - hole);
    // Nothing overlaps the hole.
    for (const p of panels) {
      const overlapX = Math.max(0, Math.min(p.left + p.width, 520 + 6) - Math.max(p.left, 400 - 6));
      const overlapY = Math.max(0, Math.min(p.top + p.height, 340 + 6) - Math.max(p.top, 300 - 6));
      expect(overlapX * overlapY).toBe(0);
    }
  });

  it('dims the whole viewport when there is no anchor', () => {
    expect(spotlightPanels(null, viewport)).toEqual([{ top: 0, left: 0, width: 1000, height: 800 }]);
  });

  it('drops empty panels when the anchor touches an edge', () => {
    const panels = spotlightPanels({ top: 0, left: 0, width: 200, height: 100 }, viewport, 0);
    expect(panels.every((p) => p.width > 0 && p.height > 0)).toBe(true);
    expect(panels).toHaveLength(2);
  });
});
