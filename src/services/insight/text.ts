/**
 * The markdown-shaped half of date detection: which parts of a document are prose (and can carry
 * a promise) and which are machinery (and cannot), plus pulling the surrounding sentence out so
 * every finding can show its evidence.
 *
 * Pure string work, no dependency on chrono.
 */

/** `[start, end)` character ranges, in document order. */
export type Range = [number, number];

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
const FENCE_RE = /^[ \t]{0,3}(```+|~~~+)/;
const INLINE_CODE_RE = /`[^`\n]*`/g;
const LINK_TARGET_RE = /\]\(\s*([^)\s]+)/g;
const BARE_URL_RE = /https?:\/\/\S+/g;

/**
 * Regions whose dates are not commitments at any confidence: a YAML frontmatter block at the top
 * of the file, fenced code blocks, and inline code spans. A `2026-11-20` inside a JSON sample is
 * a value someone is documenting, not a date they are promising.
 */
export function excludedRanges(text: string): Range[] {
  const ranges: Range[] = [];

  const front = FRONTMATTER_RE.exec(text);
  if (front && front.index === 0) ranges.push([0, front[0].length]);

  // Fences are line-oriented: an opening fence runs to the next fence of at least the same
  // length, or to the end of the document when the author never closed it.
  let offset = 0;
  let openedAt: number | null = null;
  let openMarker = '';
  for (const line of text.split('\n')) {
    const fence = FENCE_RE.exec(line);
    if (fence) {
      if (openedAt === null) {
        openedAt = offset;
        openMarker = fence[1];
      } else if (fence[1][0] === openMarker[0] && fence[1].length >= openMarker.length) {
        ranges.push([openedAt, offset + line.length + 1]);
        openedAt = null;
      }
    }
    offset += line.length + 1;
  }
  if (openedAt !== null) ranges.push([openedAt, text.length]);

  for (const m of text.matchAll(INLINE_CODE_RE)) {
    if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length]);
  }

  return ranges;
}

/**
 * Link targets and bare URLs. Not excluded — downranked: `…/2026-11-20/report.pdf` is usually a
 * filing convention rather than a deadline, but occasionally it really is the deadline, so the
 * finding is kept and flagged instead of thrown away.
 */
export function linkRanges(text: string): Range[] {
  const ranges: Range[] = [];
  for (const m of text.matchAll(LINK_TARGET_RE)) {
    if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length]);
  }
  for (const m of text.matchAll(BARE_URL_RE)) {
    if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

const SENTENCE_END = new Set(['.', '!', '?', ';']);
/** Long enough to carry the reasoning, short enough that the panel stays readable. */
const MAX_SENTENCE = 240;

/** Leading markdown decoration: heading hashes, quotes, bullets, ordered markers, table pipes. */
const LEAD_RE = /^[\s>|]*(?:#{1,6}\s*|[-*+]\s+|\d{1,3}[.)]\s+)?[\s>|]*/;
const TRAIL_RE = /[\s|]+$/;

/**
 * The sentence `text[index … index+length)` sits in, cleaned for display.
 *
 * Boundaries are a newline (markdown lines are their own thought far more often than not) or
 * sentence punctuation followed by whitespace. The result always still contains the matched
 * substring — that is what lets the panel mark it — so every cleaning step is checked and rolled
 * back if it would have destroyed the match.
 */
export function sentenceAround(text: string, index: number, length: number): string {
  const match = text.slice(index, index + length);

  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    const c = text[i];
    if (c === '\n') {
      start = i + 1;
      break;
    }
    if (SENTENCE_END.has(c) && /\s/.test(text[i + 1] ?? ' ')) {
      start = i + 1;
      break;
    }
  }

  let end = text.length;
  for (let i = index + length; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') {
      end = i;
      break;
    }
    if (SENTENCE_END.has(c) && /\s/.test(text[i + 1] ?? ' ')) {
      end = i + 1;
      break;
    }
  }

  const raw = text.slice(start, end);
  const cleaned = raw
    .replace(LEAD_RE, '')
    .replace(TRAIL_RE, '')
    .replace(/\*\*|__|(?<!\w)[*_](?!\w)/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const safe = cleaned.includes(match) ? cleaned : raw.trim();
  return clampAroundMatch(safe, match);
}

/** Keeps the match in view when the surrounding sentence is a whole paragraph. */
function clampAroundMatch(sentence: string, match: string): string {
  if (sentence.length <= MAX_SENTENCE) return sentence;
  const at = sentence.indexOf(match);
  if (at < 0) return `${sentence.slice(0, MAX_SENTENCE).trimEnd()}…`;
  const room = Math.max(0, MAX_SENTENCE - match.length);
  const from = Math.max(0, at - Math.floor(room / 2));
  const to = Math.min(sentence.length, from + MAX_SENTENCE);
  return `${from > 0 ? '…' : ''}${sentence.slice(from, to).trim()}${to < sentence.length ? '…' : ''}`;
}
