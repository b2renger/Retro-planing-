/**
 * The commitment vocabulary: the words that turn "a date is written here" into "something is
 * promised here". French and English, matched case- and accent-insensitively.
 *
 * This is deliberately a data table and not a pile of `if`s, so the vocabulary can grow — a new
 * studio word, a new venue ritual — without anyone touching the detection logic. Everything here
 * is pattern matching on the user's own text. There is no model and no network call.
 */

/** What a matched word says about the date next to it. */
export type SignalKind = 'deadline' | 'milestone';

/** One entry of the commitment vocabulary. */
export interface SignalDefinition {
  /** Stable id, reported in `DetectedDate.signals` so the UI can explain itself. */
  id: string;
  /** `deadline` wins over `milestone` when both are present in the same sentence. */
  kind: SignalKind;
  /** Confidence added when this signal is present (the strongest match only, they do not stack). */
  weight: number;
  /** Written accent-free and lowercase — `normalizeForSignals` is applied to the text too. */
  patterns: string[];
}

/**
 * The table. Order is irrelevant; matching is exhaustive and the strongest weight wins.
 *
 * `deadline` = a date something is owed by. `milestone` = a fixed event the plan hangs off
 * (a vernissage cannot be moved, but nothing is *due* on it in the contractual sense).
 */
export const SIGNALS: SignalDefinition[] = [
  { id: 'deadline', kind: 'deadline', weight: 0.4, patterns: ['deadline', 'deadlines'] },
  { id: 'echeance', kind: 'deadline', weight: 0.4, patterns: ['echeance', 'echeances'] },
  { id: 'au-plus-tard', kind: 'deadline', weight: 0.4, patterns: ['au plus tard'] },
  { id: 'avant-le', kind: 'deadline', weight: 0.3, patterns: ['avant le', 'avant la'] },
  { id: 'jusquau', kind: 'deadline', weight: 0.3, patterns: ["jusqu'au", 'jusqu au'] },
  { id: 'due', kind: 'deadline', weight: 0.35, patterns: ['due', 'due date', 'due by', 'overdue'] },
  { id: 'must-be', kind: 'deadline', weight: 0.3, patterns: ['must be', 'must ship', 'no later than'] },
  { id: 'doit-etre', kind: 'deadline', weight: 0.3, patterns: ['doit etre', 'doivent etre'] },
  { id: 'livraison', kind: 'deadline', weight: 0.35, patterns: ['livraison', 'livraisons', 'delivery'] },
  { id: 'remise', kind: 'deadline', weight: 0.35, patterns: ['remise', 'remise des', 'hand in'] },
  { id: 'rendu', kind: 'deadline', weight: 0.3, patterns: ['rendu', 'rendus'] },
  { id: 'livrable', kind: 'deadline', weight: 0.3, patterns: ['livrable', 'livrables', 'deliverable', 'deliverables'] },
  { id: 'final', kind: 'deadline', weight: 0.2, patterns: ['final', 'finale', 'finales', 'finaux'] },

  { id: 'vernissage', kind: 'milestone', weight: 0.35, patterns: ['vernissage', 'vernissages'] },
  { id: 'opening', kind: 'milestone', weight: 0.35, patterns: ['opening', 'opening night', 'premiere'] },
  { id: 'montage', kind: 'milestone', weight: 0.3, patterns: ['montage', 'load-in', 'load in'] },
  { id: 'demontage', kind: 'milestone', weight: 0.3, patterns: ['demontage', 'load-out', 'load out'] },
  { id: 'repetition', kind: 'milestone', weight: 0.25, patterns: ['repetition', 'repetitions', 'rehearsal', 'rehearsals'] },
  { id: 'filage', kind: 'milestone', weight: 0.25, patterns: ['filage', 'filages'] },
  { id: 'presentation', kind: 'milestone', weight: 0.2, patterns: ['presentation', 'presentations'] },
  { id: 'soutenance', kind: 'milestone', weight: 0.3, patterns: ['soutenance', 'soutenances'] },
  { id: 'jury', kind: 'milestone', weight: 0.3, patterns: ['jury', 'jurys', 'juries'] },
  { id: 'installation', kind: 'milestone', weight: 0.2, patterns: ['installation', 'installations'] },
];

/**
 * Lowercases, folds accents away and normalises both apostrophe shapes, so `Échéance` and
 * `echeance`, `jusqu’au` and `jusqu'au` are the same string. Only ever used for *matching*;
 * offsets and displayed text always come from the original string.
 */
export function normalizeForSignals(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase();
}

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

/** Cached `pattern -> RegExp`, built once per pattern. */
const patternCache = new Map<string, RegExp>();

function patternRegExp(pattern: string): RegExp {
  let re = patternCache.get(pattern);
  if (!re) {
    // Not `\b`: the patterns contain spaces, hyphens and apostrophes, and `\b` around those is
    // meaningless. Guarding on alphanumerics is what actually stops `due` matching `produce`.
    re = new RegExp(`(?<![a-z0-9])${pattern.replace(ESCAPE_RE, '\\$&')}(?![a-z0-9])`);
    patternCache.set(pattern, re);
  }
  return re;
}

/** A signal found in a sentence. */
export interface SignalHit {
  id: string;
  kind: SignalKind;
  weight: number;
}

/**
 * Every signal present in `sentence`, strongest first. The sentence does not need to be
 * normalised — this does it.
 */
export function matchSignals(sentence: string): SignalHit[] {
  const haystack = normalizeForSignals(sentence);
  const hits: SignalHit[] = [];
  for (const def of SIGNALS) {
    if (def.patterns.some((p) => patternRegExp(p).test(haystack))) {
      hits.push({ id: def.id, kind: def.kind, weight: def.weight });
    }
  }
  return hits.sort((a, b) => b.weight - a.weight);
}
