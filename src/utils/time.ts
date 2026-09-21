/**
 * Timestamp rendering. One implementation, used everywhere a stored ISO string reaches the screen:
 * the relative form is what a person reads, the absolute form goes in a `title` so the exact moment
 * is still one hover away.
 *
 * Both return `null` for a missing or unparseable value, so a caller renders nothing rather than
 * "Invalid Date" or a fabricated time.
 */

/** Browser locale, with a stable fallback so tests and SSR do not drift. */
export const FALLBACK_LOCALE = 'en-GB';

export function resolveLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return FALLBACK_LOCALE;
}

/** `"4 min ago"` style. */
export function relativeTime(iso: string | undefined | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

/** Full date + time for a `title` attribute, in the reader's locale. */
export function absoluteTime(iso: string | undefined | null, locale: string = resolveLocale()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/** `{ text, title }` for a timestamp, or `null` when there is nothing honest to show. */
export function timestampLabel(iso: string | undefined | null, now?: number): { text: string; title: string } | null {
  const text = relativeTime(iso, now);
  if (!text) return null;
  return { text, title: absoluteTime(iso) ?? text };
}
