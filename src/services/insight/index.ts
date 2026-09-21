/**
 * The insight boundary.
 *
 * `docs/dev/LOCAL-INFERENCE.md` asks for one interface so that a later tier — embeddings, then a
 * small ONNX classifier — can be swapped in without the rest of the app noticing. Every result
 * carries a `confidence` and a `source` saying which tier produced it.
 *
 * Today exactly one tier exists: `heuristic`, which is `chrono-node` plus the rules in
 * `dates.ts`. No model, no download, no network. When a second tier arrives it answers here.
 */
import type { MarkdownDoc } from '../../types';
import { findDates, type DetectedDate, type FindDatesOptions } from './dates';

export { findDates } from './dates';
export type { DetectedDate, FindDatesOptions } from './dates';
export { suggestFromDocument, titleFromSentence } from './suggestions';
export type { Suggestion, SuggestionApply, SuggestionKind, SuggestOptions } from './suggestions';
export { SIGNALS, matchSignals, normalizeForSignals } from './signals';
export type { SignalDefinition, SignalHit, SignalKind } from './signals';

/** Which tier answered. Only `heuristic` is implemented; the other two are the planned upgrades. */
export type InsightSource = 'heuristic' | 'embedding' | 'model';

/** Every insight call answers in this shape, so the UI can always say where an answer came from. */
export interface InsightResult<T> {
  items: T[];
  source: InsightSource;
}

/** Dates in a document that look like commitments, newest tier first (there is only one). */
export function findDeadlines(doc: MarkdownDoc, opts?: FindDatesOptions): InsightResult<DetectedDate> {
  return { items: findDates(doc.content, opts), source: 'heuristic' };
}
