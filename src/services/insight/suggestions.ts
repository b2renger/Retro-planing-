/**
 * Turns dates found in a document into proposed actions.
 *
 * Every entry is a *proposal*: it carries the sentence it came from, a confidence, the fact that
 * it came from pattern matching (`source: 'heuristic'`) and a serialisable description of what
 * accepting it would do. Nothing here calls the store — the component performs the action, and
 * only after the user clicks. That is the rule from `docs/dev/LOCAL-INFERENCE.md`.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { MarkdownDoc, Project } from '../../types';
import { findDates, type DetectedDate } from './dates';

export type SuggestionKind = 'set-delivery-date' | 'create-milestone' | 'warning';

/**
 * What accepting would do, as data. Deliberately not a closure: a suggestion can be logged,
 * compared, tested and shown to the user without anything being able to run by accident.
 */
export type SuggestionApply =
  | { action: 'set-delivery-date'; date: string; mode: 'anchor-only' | 'shift-all' }
  | { action: 'create-milestone'; title: string; targetDate: string; isHardDeadline: boolean; description: string }
  | { action: 'none' };

export interface Suggestion {
  /** Stable across re-analysis of the same document, so React keys and dismissals survive. */
  id: string;
  kind: SuggestionKind;
  /** One line, imperative for actions ("Set 20 November 2026 as the delivery date"). */
  title: string;
  /** Why this is being proposed, in the user's terms. */
  detail: string;
  confidence: number;
  /** Which tier produced it. Tier 0 is rules over text; see `docs/dev/LOCAL-INFERENCE.md`. */
  source: 'heuristic';
  evidence: { sentence: string; documentId: string; offset: number };
  apply: SuggestionApply;
}

export interface SuggestOptions {
  /** Anchor for relative expressions *and* for "has this already passed?". Defaults to now. */
  today?: Date;
  /** Reuse a detection the caller already ran, instead of parsing the document again. */
  dates?: DetectedDate[];
}

/** A milestone this close to a date is already the same event under another name. */
const MILESTONE_PROXIMITY_DAYS = 2;

/**
 * Below this, a finding is shown in the panel but never proposed as an action. It is the
 * threshold an unanchored relative expression ("due next week", no reference) falls under.
 */
const MIN_ACTIONABLE_CONFIDENCE = 0.45;

const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** `YYYY-MM-DD` strings compare correctly as strings; this just says so out loud. */
const isAfter = (a: string, b: string): boolean => a > b;

/**
 * A milestone title from the sentence the date was found in: the prose minus the date itself,
 * minus markdown and label punctuation, cut at a word boundary. Never the whole paragraph.
 */
export function titleFromSentence(sentence: string, matched: string, fallback: string): string {
  // A "Label: value" line names the event in the label — "Installation Load-In: October 29".
  const label = /^([^:\n]{6,60}):/.exec(sentence.trim());
  const labelled = label !== null && !label[1].includes(matched);

  let s = (labelled ? label[1] : sentence.replace(matched, ' '))
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.])/g, '$1');

  // Otherwise the first clause carries the event and the rest carries the qualifiers:
  // "la remise du dossier est due le, au plus tard" is titled by everything before the comma.
  if (!labelled) {
    const comma = s.indexOf(',');
    if (comma >= 12) s = s.slice(0, comma);
  }

  s = trimEdges(s);
  if (s.length > 60) {
    const cut = s.slice(0, 60);
    const space = cut.lastIndexOf(' ');
    s = `${trimEdges(space > 20 ? cut.slice(0, space) : cut)}…`;
  }
  if (s.length < 3) return fallback;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Punctuation and dangling articles left behind once the date is lifted out of the sentence. */
function trimEdges(text: string): string {
  let out = text.trim();
  for (let prev = ''; out !== prev; ) {
    prev = out;
    out = out
      .replace(/^[\s,;:.–—-]+/, '')
      .replace(/[\s,;:.–—-]+$/, '')
      .replace(/\s(?:le|la|les|du|de|des|au|aux|à|a|en|the|on|by|for|of|in|is|est)$/i, '');
  }
  return out.trim();
}

/** Human date for the copy. Fixed to `fr-FR`-neutral long form via `Intl`, falling back to ISO. */
function longDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(iso));
  } catch {
    return iso;
  }
}

/**
 * Proposals for one document, best first.
 *
 * Only commitment-shaped findings (`deadline` / `milestone`) ever become a suggestion — a date
 * merely mentioned in prose is listed in the panel but never proposed, and a date flagged
 * `implausible-year` never is either.
 */
export function suggestFromDocument(doc: MarkdownDoc, project: Project, opts?: SuggestOptions): Suggestion[] {
  const today = opts?.today ?? new Date();
  const dates = opts?.dates ?? findDates(doc.content, { referenceDate: today });
  const todayIso = isoDay(today);
  const out: Suggestion[] = [];

  for (const d of dates) {
    if (d.kind === 'mention') continue;
    if (d.signals.includes('implausible-year')) continue;
    if (d.confidence < MIN_ACTIONABLE_CONFIDENCE) continue;

    const evidence = { sentence: d.sentence, documentId: doc.id, offset: d.offset };
    const when = longDate(d.iso);
    const key = `${doc.id}:${d.offset}:${d.iso}`;

    // 1. A deadline past the end of the whole schedule is a candidate delivery date.
    const pastEveryPhase = project.phases.every((p) => isAfter(d.iso, p.endDate));
    if (d.kind === 'deadline' && pastEveryPhase && d.iso !== project.targetDeliveryDate) {
      out.push({
        id: `set-delivery:${key}`,
        kind: 'set-delivery-date',
        title: `Set ${when} as the target delivery date`,
        detail: `This document reads like a delivery commitment on ${when}, and it falls after every phase currently in the plan. The target is ${longDate(project.targetDeliveryDate)}. Accepting moves the target only — the schedule is not shifted.`,
        confidence: d.confidence,
        source: 'heuristic',
        evidence,
        apply: { action: 'set-delivery-date', date: d.iso, mode: 'anchor-only' },
      });
    }

    // 2. A commitment with nothing in the plan near it.
    const near = project.milestones.some(
      (m) => Math.abs(differenceInCalendarDays(parseISO(m.targetDate), parseISO(d.iso))) <= MILESTONE_PROXIMITY_DAYS
    );
    if (!near) {
      const title = titleFromSentence(d.sentence, d.text, doc.title.replace(/\.md$/i, ''));
      out.push({
        id: `milestone:${key}`,
        kind: 'create-milestone',
        title: `Create a milestone on ${when}`,
        detail: `“${title}” — nothing in the plan lands within ${MILESTONE_PROXIMITY_DAYS} days of ${when}.`,
        confidence: d.confidence,
        source: 'heuristic',
        evidence,
        apply: {
          action: 'create-milestone',
          title,
          targetDate: d.iso,
          isHardDeadline: d.kind === 'deadline',
          description: `From ${doc.title}: “${d.sentence}”`,
        },
      });
    }

    // 3. A commitment the plan has no room for.
    if (isAfter(d.iso, project.targetDeliveryDate)) {
      out.push({
        id: `past-target:${key}`,
        kind: 'warning',
        title: `${when} is after your delivery date`,
        detail: `This document commits to something on ${when}, past the target delivery date of ${longDate(project.targetDeliveryDate)}. Either the document or the target is out of date.`,
        confidence: d.confidence,
        source: 'heuristic',
        evidence,
        apply: { action: 'none' },
      });
    }

    // 4. A commitment that has already gone by.
    if (isAfter(todayIso, d.iso)) {
      out.push({
        id: `overdue:${key}`,
        kind: 'warning',
        title: `${when} has already passed`,
        detail: `This reads like a commitment on ${when}, which is in the past. If it happened, the plan may not say so; if it did not, it needs re-dating.`,
        confidence: d.confidence,
        source: 'heuristic',
        evidence,
        apply: { action: 'none' },
      });
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}
