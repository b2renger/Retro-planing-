/**
 * How a detected date is put into words.
 *
 * Kept out of the component and out of the service so it can be read (and tested) as what it is:
 * the sentence the user sees. The rule that matters here is that a confidence is **never** shown
 * as a bare percentage — "likely a deadline" is a claim someone can argue with, "0.87" is not.
 */
import { parseISO } from 'date-fns';
import type { DetectedDate } from '../../services/insight';

/** The user's own locale, whatever the browser says it is. */
function dayFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** `20 novembre 2026`, `18 – 20 novembre 2026`, or the raw ISO if `Intl` refuses. */
export function formatDetected(date: DetectedDate): string {
  try {
    const fmt = dayFormatter();
    const start = parseISO(date.iso);
    if (date.isRange && date.endIso) {
      const end = parseISO(date.endIso);
      return typeof fmt.formatRange === 'function'
        ? fmt.formatRange(start, end)
        : `${fmt.format(start)} – ${fmt.format(end)}`;
    }
    return fmt.format(start);
  } catch {
    return date.endIso ? `${date.iso} – ${date.endIso}` : date.iso;
  }
}

/**
 * A short phrase for how much weight to put on a finding. Hedged on purpose: the panel is
 * guessing from words in a sentence, and it should sound like it.
 */
export function confidenceLabel(date: DetectedDate): string {
  if (date.signals.includes('implausible-year')) return 'year looks wrong';
  if (date.signals.includes('unanchored-relative')) return 'relative, no anchor';
  if (date.signals.includes('in-link')) return 'from a link';
  if (date.kind === 'deadline') return date.confidence >= 0.75 ? 'likely a deadline' : 'possibly a deadline';
  if (date.kind === 'milestone') return date.confidence >= 0.75 ? 'likely a fixed date' : 'possibly a fixed date';
  return 'mentioned';
}
