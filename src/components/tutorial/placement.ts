/**
 * Where to put the coachmark card. Pure geometry so it can be unit-tested without a DOM:
 * try the preferred side, flip to the opposite when it would overflow, then try the remaining
 * sides, and fall back to the centre of the viewport when nothing fits (or there is no anchor).
 */
import type { Placement } from './steps';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PlacementInput {
  /** Viewport-relative rect of the target, or `null` when the element is not on screen. */
  anchor: Rect | null;
  card: Size;
  viewport: Size;
  preferred: Placement;
  /** Space between the anchor and the card. */
  gap?: number;
  /** Minimum distance kept from every viewport edge. */
  margin?: number;
}

export interface PlacementResult {
  top: number;
  left: number;
  /** The side actually used — may differ from `preferred` after a flip. */
  placement: Placement;
  /** True when the card was centred because no side fitted or there was no anchor. */
  fallback: boolean;
}

const OPPOSITE: Record<Exclude<Placement, 'center'>, Exclude<Placement, 'center'>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const ORDER: Exclude<Placement, 'center'>[] = ['bottom', 'top', 'right', 'left'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function centred(card: Size, viewport: Size): { top: number; left: number } {
  return {
    top: Math.max(0, Math.round((viewport.height - card.height) / 2)),
    left: Math.max(0, Math.round((viewport.width - card.width) / 2)),
  };
}

/** Does the card fit on this side of the anchor without crossing a viewport edge? */
export function fits(side: Exclude<Placement, 'center'>, input: Required<Omit<PlacementInput, 'preferred'>> & { anchor: Rect }): boolean {
  const { anchor, card, viewport, gap, margin } = input;
  if (side === 'top') return anchor.top - gap - card.height >= margin;
  if (side === 'bottom') return anchor.top + anchor.height + gap + card.height <= viewport.height - margin;
  if (side === 'left') return anchor.left - gap - card.width >= margin;
  return anchor.left + anchor.width + gap + card.width <= viewport.width - margin;
}

export function computePlacement(input: PlacementInput): PlacementResult {
  const gap = input.gap ?? 12;
  const margin = input.margin ?? 12;
  const { card, viewport, anchor, preferred } = input;

  if (!anchor || preferred === 'center' || anchor.width <= 0 || anchor.height <= 0) {
    return { ...centred(card, viewport), placement: 'center', fallback: anchor === null || anchor.width <= 0 || anchor.height <= 0 };
  }

  const base = { anchor, card, viewport, gap, margin };
  const candidates: Exclude<Placement, 'center'>[] = [preferred, OPPOSITE[preferred], ...ORDER];
  const side = candidates.find((s) => fits(s, base));
  if (!side) return { ...centred(card, viewport), placement: 'center', fallback: true };

  const maxLeft = Math.max(margin, viewport.width - card.width - margin);
  const maxTop = Math.max(margin, viewport.height - card.height - margin);

  if (side === 'top' || side === 'bottom') {
    const top = side === 'top' ? anchor.top - gap - card.height : anchor.top + anchor.height + gap;
    const left = clamp(anchor.left + anchor.width / 2 - card.width / 2, margin, maxLeft);
    return { top: Math.round(top), left: Math.round(left), placement: side, fallback: false };
  }

  const left = side === 'left' ? anchor.left - gap - card.width : anchor.left + anchor.width + gap;
  const top = clamp(anchor.top + anchor.height / 2 - card.height / 2, margin, maxTop);
  return { top: Math.round(top), left: Math.round(left), placement: side, fallback: false };
}

/** The four dim panels of the spotlight: everything except a padded hole around the anchor. */
export function spotlightPanels(anchor: Rect | null, viewport: Size, pad = 6): Rect[] {
  if (!anchor) return [{ top: 0, left: 0, width: viewport.width, height: viewport.height }];
  const top = Math.max(0, anchor.top - pad);
  const left = Math.max(0, anchor.left - pad);
  const right = Math.min(viewport.width, anchor.left + anchor.width + pad);
  const bottom = Math.min(viewport.height, anchor.top + anchor.height + pad);
  return [
    { top: 0, left: 0, width: viewport.width, height: top },
    { top: bottom, left: 0, width: viewport.width, height: Math.max(0, viewport.height - bottom) },
    { top, left: 0, width: left, height: Math.max(0, bottom - top) },
    { top, left: right, width: Math.max(0, viewport.width - right), height: Math.max(0, bottom - top) },
  ].filter((r) => r.width > 0 && r.height > 0);
}
