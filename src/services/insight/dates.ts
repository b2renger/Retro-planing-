/**
 * Tier 0 of `docs/dev/LOCAL-INFERENCE.md`: find the dates hiding in the user's own notes.
 *
 * No model, no download, no API. `chrono-node` parses natural-language dates in French and
 * English; the rules in this file decide whether a date looks like a commitment or just a
 * mention, and every result carries the sentence it came from so the UI can show *why*.
 *
 * Pure and synchronous. Nothing here writes to the project — `suggestions.ts` turns these
 * findings into proposed actions and the user accepts them one by one.
 */
import { format } from 'date-fns';
import type { ParsedResult } from 'chrono-node/en';
import * as chronoEn from 'chrono-node/en';
import * as chronoFr from 'chrono-node/fr';
import { matchSignals, normalizeForSignals } from './signals';
import { excludedRanges, linkRanges, sentenceAround } from './text';

/** One date found in a document, with everything needed to explain it. */
export interface DetectedDate {
  /** `YYYY-MM-DD` — the calendar day, which is the shape every date in this app is stored in. */
  iso: string;
  /** The exact substring that matched, e.g. `20 novembre 2026`. */
  text: string;
  /** The sentence it was found in, cleaned of markdown decoration. Always contains `text`. */
  sentence: string;
  /** Index of `text` in the document, for anchoring the evidence. */
  offset: number;
  /** `0`–`1`. Never shown as a bare percentage; the UI turns it into words. */
  confidence: number;
  /** What the surrounding words say this date is. */
  kind: 'deadline' | 'milestone' | 'mention';
  /** Signal ids from `SIGNALS`, plus structural notes like `in-link` or `implausible-year`. */
  signals: string[];
  /** A time of day was written, not just a day. */
  hasTime: boolean;
  /** `du 18 au 20 novembre` — one entry, two ends. */
  isRange: boolean;
  /** `YYYY-MM-DD` end of the range; only set when `isRange`. */
  endIso?: string;
  /** Other sentences that mentioned the same calendar date (deduplication keeps the best one). */
  otherSentences?: string[];
}

export interface FindDatesOptions {
  /**
   * What "next week" is relative to. **Always pass it** — without one, relative expressions are
   * downranked and flagged `unanchored-relative`, because they mean nothing on their own.
   */
  referenceDate?: Date;
  /** `auto` (default) runs both parsers and keeps whichever found more. */
  locale?: 'fr' | 'en' | 'auto';
}

/** A date this far from the reference is a typo or a version string, not a plan. */
const PLAUSIBLE_YEARS = 10;

/**
 * Sub-day units. `chrono.en.casual` happily reads "warm up for 20 minutes" as a date — today,
 * twenty minutes from the reference — and a QA checklist is full of those. A match that names
 * only a duration smaller than a day, with no calendar word and no year, is a duration.
 */
const SUBDAY_UNIT_RE = /(?<![a-z])(minutes?|mins?|hours?|hrs?|heures?|secondes?|seconds?|secs?)(?![a-z])/;

/** Anything that makes a match about the calendar rather than the stopwatch. */
const CALENDAR_WORD_RE =
  /(?<![a-z])(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|january|february|march|april|june|july|august|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|demain|hier|aujourd'hui|today|tomorrow|yesterday|jours?|days?|semaines?|weeks?|mois|months?|annees?|years?)(?![a-z])/;

/** Relative wording, French and English. Only consulted when the match has no explicit year. */
const RELATIVE_RE =
  /(?<![a-z])(next|last|coming|upcoming|tomorrow|yesterday|today|tonight|weeks?|months?|years?|prochaine?s?|derni(?:er|ere)s?|dans|demain|hier|aujourd'hui|semaines?|mois|annees?)(?![a-z])/;

/** What one parser run produces, flattened out of chrono's classes so it can be moved around. */
interface RawHit {
  index: number;
  text: string;
  start: Date;
  end: Date | null;
  yearKnown: boolean;
  dayKnown: boolean;
  monthKnown: boolean;
  hasTime: boolean;
}

/**
 * The slice of a chrono locale module this file uses. Structural on purpose: `chrono.en` and
 * `chrono.fr` are not the same type (English carries an extra `GB` variant), but both expose the
 * two parsers below, and that is all that is needed here.
 */
interface LocaleParser {
  casual: { parse(text: string, ref: Date, option: Record<string, never>): ParsedResult[] };
  strict: { parse(text: string, ref: Date, option: Record<string, never>): ParsedResult[] };
}

/** A result chrono anchored to nothing — `night`, `à 18h` — is noise, not a date. */
function hasDateComponent(start: { isCertain(c: 'day' | 'month' | 'year' | 'weekday'): boolean }): boolean {
  return start.isCertain('day') || start.isCertain('month') || start.isCertain('year') || start.isCertain('weekday');
}

function toRaw(r: ParsedResult, shift: number): RawHit {
  return {
    index: r.index + shift,
    text: r.text,
    start: r.start.date(),
    end: r.end ? r.end.date() : null,
    yearKnown: r.start.isCertain('year'),
    dayKnown: r.start.isCertain('day'),
    monthKnown: r.start.isCertain('month'),
    hasTime: r.start.isCertain('hour'),
  };
}

/**
 * Casual parsing plus a strict rescue.
 *
 * Casual mode is what understands "dans trois semaines" and "next week", but it also swallows
 * bare time-of-day words: it reads "Opening night on November 20, 2026" as one anchorless blob
 * starting at "night", losing the date entirely. So anything casual returns with no certain date
 * component is thrown away and the same span is re-parsed in strict mode, which finds the real
 * date inside it.
 */
function parseWith(chrono: LocaleParser, text: string, ref: Date): RawHit[] {
  const out: RawHit[] = [];
  for (const r of chrono.casual.parse(text, ref, {})) {
    if (hasDateComponent(r.start)) {
      out.push(toRaw(r, 0));
      continue;
    }
    const span = text.slice(r.index, r.index + r.text.length);
    for (const rescued of chrono.strict.parse(span, ref, {})) {
      if (hasDateComponent(rescued.start)) out.push(toRaw(rescued, r.index));
    }
  }
  return out.filter((h) => !isDuration(h.text) && !isBareWeekdayAbbreviation(h)).sort((a, b) => a.index - b.index);
}

/**
 * `SAM GLM` in a speaker spec is not Saturday, and `mar.` in a table is not Tuesday. A match
 * whose only certain component is a weekday and which is three characters or fewer is an
 * abbreviation that happened to collide. Written-out weekdays ("vendredi prochain") are long
 * enough to survive this.
 */
function isBareWeekdayAbbreviation(h: RawHit): boolean {
  return !h.yearKnown && !h.dayKnown && !h.monthKnown && h.text.trim().length < 4;
}

function isDuration(text: string): boolean {
  const n = normalizeForSignals(text);
  return SUBDAY_UNIT_RE.test(n) && !CALENDAR_WORD_RE.test(n) && !/\d{4}/.test(n) && !/\d{1,2}[/.-]\d{1,2}/.test(n);
}

/**
 * Both locales, not one.
 *
 * Preferring whichever parser found more is the right call for the *overlaps* — a French
 * document read by the English parser produces nonsense — but these users write French briefs
 * with English hardware dates in them, and picking one parser silently loses half the document.
 * So the winner's hits are kept whole and the loser's non-overlapping ones are added.
 */
function mergeHits(primary: RawHit[], secondary: RawHit[]): RawHit[] {
  const out = [...primary];
  for (const h of secondary) {
    // The losing parser only gets to contribute dates it is sure of. Left unfiltered it reads
    // the other language's prose as weekday abbreviations and fills the panel with noise.
    if (!h.yearKnown && !(h.dayKnown && h.monthKnown)) continue;
    const clashes = primary.some((p) => h.index < p.index + p.text.length && p.index < h.index + h.text.length);
    if (!clashes) out.push(h);
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Cheap French evidence, used only to break a tie between the two parsers. */
function frenchScore(text: string): number {
  const hits = text.match(/(?<![a-z])(le|la|les|du|des|au|aux|et|est|pour|avec|dans|sur)(?![a-z])/gi);
  const accents = text.match(/[àâçéèêëîïôûùüÿœ]/gi);
  return (hits?.length ?? 0) + (accents?.length ?? 0);
}

function within(index: number, ranges: [number, number][]): boolean {
  return ranges.some(([s, e]) => index >= s && index < e);
}

const clamp = (n: number): number => Math.min(0.98, Math.max(0.05, n));

/**
 * Every date in `text`, best first for each calendar day.
 *
 * Skipped outright: anything inside a fenced code block, inline code, or a YAML frontmatter
 * block — those are data, not promises. Downranked but kept (with a signal saying so): dates
 * inside a link target, relative expressions with no `referenceDate`, and years more than a
 * decade from the reference, which are marked `implausible-year` and can never become a
 * suggestion. Nothing is dropped silently that a user could reasonably expect to see.
 */
export function findDates(text: string, opts?: FindDatesOptions): DetectedDate[] {
  if (!text.trim()) return [];
  const ref = opts?.referenceDate ?? new Date();
  const anchored = opts?.referenceDate !== undefined;
  const locale = opts?.locale ?? 'auto';

  let raw: RawHit[];
  if (locale === 'fr') raw = parseWith(chronoFr, text, ref);
  else if (locale === 'en') raw = parseWith(chronoEn, text, ref);
  else {
    const fr = parseWith(chronoFr, text, ref);
    const en = parseWith(chronoEn, text, ref);
    const frWins = fr.length === en.length ? frenchScore(text) > 0 && fr.length > 0 : fr.length > en.length;
    raw = frWins ? mergeHits(fr, en) : mergeHits(en, fr);
  }

  const skip = excludedRanges(text);
  const links = linkRanges(text);
  const refYear = ref.getFullYear();
  const found: DetectedDate[] = [];

  for (const hit of raw) {
    if (within(hit.index, skip)) continue;

    const iso = format(hit.start, 'yyyy-MM-dd');
    const endIso = hit.end ? format(hit.end, 'yyyy-MM-dd') : undefined;
    const isRange = endIso !== undefined && endIso !== iso;
    const sentence = sentenceAround(text, hit.index, hit.text.length);
    const hits = matchSignals(sentence);
    const signals = hits.map((h) => h.id);

    // "next week" looks fully specified once chrono has resolved it — day, month and year all
    // come back "known". They were inferred, not written, so the explicitness bonus below is not
    // theirs to collect.
    const isRelative = !/\d{4}/.test(hit.text) && RELATIVE_RE.test(normalizeForSignals(hit.text));

    let confidence = 0.3;
    if (!isRelative) {
      if (hit.yearKnown) confidence += 0.15;
      if (hit.dayKnown && hit.monthKnown) confidence += 0.1;
    }
    if (hit.hasTime) confidence += 0.05;
    if (hits.length > 0) confidence += hits[0].weight;

    if (within(hit.index, links)) {
      signals.push('in-link');
      confidence -= 0.2;
    }
    if (isRelative && !anchored) {
      signals.push('unanchored-relative');
      confidence -= 0.25;
    }

    let kind: DetectedDate['kind'] = hits.some((h) => h.kind === 'deadline')
      ? 'deadline'
      : hits.length > 0
        ? 'milestone'
        : 'mention';

    if (Math.abs(hit.start.getFullYear() - refYear) > PLAUSIBLE_YEARS) {
      signals.push('implausible-year');
      kind = 'mention';
      confidence = 0.05;
    }

    found.push({
      iso,
      text: hit.text,
      sentence,
      offset: hit.index,
      confidence: Math.round(clamp(confidence) * 100) / 100,
      kind,
      signals,
      hasTime: hit.hasTime,
      isRange,
      ...(isRange ? { endIso } : {}),
    });
  }

  return dedupe(found);
}

/**
 * One entry per calendar date (a range counts as its own date). The highest-confidence
 * occurrence wins, but the sentences of the others are kept: "the 20th" written in three places
 * is stronger evidence, not weaker, and the user should see all three.
 */
function dedupe(found: DetectedDate[]): DetectedDate[] {
  const byKey = new Map<string, DetectedDate>();
  for (const d of found) {
    const key = `${d.iso}|${d.endIso ?? ''}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, d);
      continue;
    }
    const [best, other] = d.confidence > prev.confidence ? [d, prev] : [prev, d];
    const seen = new Set([best.sentence, ...(best.otherSentences ?? [])]);
    const extra = [...(best.otherSentences ?? []), ...(other.otherSentences ?? [])];
    if (!seen.has(other.sentence)) extra.push(other.sentence);
    byKey.set(key, { ...best, ...(extra.length > 0 ? { otherSentences: [...new Set(extra)] } : {}) });
  }
  return [...byKey.values()].sort((a, b) => (a.iso === b.iso ? a.offset - b.offset : a.iso < b.iso ? -1 : 1));
}
