import { AiError, type AiProviderId } from './types';

const FENCE_RE = /```(?:json|JSON)?\s*([\s\S]*?)```/;
/** How many `{` / `[` start positions to try in a candidate before giving up (keeps pathological input linear-ish). */
const MAX_BRACKET_STARTS = 8;

function excerpt(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

/**
 * Return the substring from `start` to the bracket matching `text[start]`, honouring strings and
 * escapes so braces inside string values do not confuse the scan. Returns null when unbalanced.
 */
function sliceBalanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return ch === close ? text.slice(start, i + 1) : null;
    }
  }
  return null;
}

function tryParse<T>(candidate: string): T | undefined {
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return undefined;
  }
}

/** Parse the first balanced `{…}` / `[…]` in `candidate` that is valid JSON, trying a bounded number of start positions. */
function parseEmbedded<T>(candidate: string): T | undefined {
  let from = 0;
  for (let attempt = 0; attempt < MAX_BRACKET_STARTS; attempt++) {
    const rel = candidate.slice(from).search(/[{[]/);
    if (rel < 0) return undefined;
    const start = from + rel;
    const balanced = sliceBalanced(candidate, start);
    if (balanced) {
      const parsed = tryParse<T>(balanced);
      if (parsed !== undefined) return parsed;
    }
    from = start + 1;
  }
  return undefined;
}

/**
 * Extract a JSON value from a model reply that may contain markdown fences or prose around it.
 * Strategy: fenced block first, then the whole text, then the first balanced `{…}` / `[…]` that parses
 * (a few start positions are tried so a brace in the surrounding prose does not hide the payload).
 * Throws AiError('parse') with a short excerpt when nothing parses.
 */
export function extractJson<T = unknown>(text: string, providerId: AiProviderId | 'unknown' = 'unknown'): T {
  const raw = typeof text === 'string' ? text : '';
  const fenced = FENCE_RE.exec(raw);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(raw.trim());

  for (const candidate of candidates) {
    const direct = tryParse<T>(candidate);
    if (direct !== undefined) return direct;
    const embedded = parseEmbedded<T>(candidate);
    if (embedded !== undefined) return embedded;
  }
  throw new AiError(`Reply is not valid JSON: "${excerpt(raw)}"`, 'parse', providerId);
}
