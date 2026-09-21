/**
 * Every test pins an explicit `referenceDate`. Date tests that lean on the machine clock rot
 * silently the week after they are written; these must still pass in 2030.
 */
import { describe, expect, it } from 'vitest';
import { findDates } from './dates';
import { SIGNALS, matchSignals, normalizeForSignals } from './signals';
import { sentenceAround } from './text';

/** Monday 21 September 2026, local time — the reference every test parses against. */
const REF = new Date(2026, 8, 21, 12, 0, 0);

const isos = (text: string, locale?: 'fr' | 'en' | 'auto') =>
  findDates(text, { referenceDate: REF, locale }).map((d) => d.iso);

const one = (text: string, locale?: 'fr' | 'en' | 'auto') => {
  const found = findDates(text, { referenceDate: REF, locale });
  expect(found).toHaveLength(1);
  return found[0];
};

describe('findDates — French', () => {
  it('reads an absolute French date written out', () => {
    const d = one('Le vernissage est le 20 novembre 2026.');
    expect(d.iso).toBe('2026-11-20');
    expect(d.text).toBe('20 novembre 2026');
    expect(d.hasTime).toBe(false);
    expect(d.isRange).toBe(false);
  });

  it('reads a French numeric date as day/month/year', () => {
    expect(isos('La remise est le 20/11/2026.')).toEqual(['2026-11-20']);
  });

  it('resolves a French relative expression against the reference date', () => {
    const d = one('On livre dans trois semaines.');
    expect(d.iso).toBe('2026-10-12');
    expect(d.signals).not.toContain('unanchored-relative');
  });

  it('resolves a French weekday expression against the reference date', () => {
    expect(isos('Filage vendredi prochain.')).toEqual(['2026-10-02']);
  });

  it('keeps a time of day when one is written', () => {
    const d = one('Vernissage le 20 novembre 2026 à 18h30.');
    expect(d.iso).toBe('2026-11-20');
    expect(d.hasTime).toBe(true);
  });

  it('collapses a French range into a single entry with both ends', () => {
    const d = one('Montage du 18 au 20 novembre 2026.');
    expect(d.isRange).toBe(true);
    expect(d.iso).toBe('2026-11-18');
    expect(d.endIso).toBe('2026-11-20');
  });
});

describe('findDates — English', () => {
  it('reads an absolute English date', () => {
    expect(isos('The opening is on November 20, 2026.')).toEqual(['2026-11-20']);
  });

  it('reads an ISO date written in prose', () => {
    expect(isos('The deadline is 2026-11-20 sharp.')).toEqual(['2026-11-20']);
  });

  it('resolves an English relative expression against the reference date', () => {
    const d = one('The final deliverable is due next week.');
    expect(d.iso).toBe('2026-09-28');
  });

  it('collapses an English range into a single entry', () => {
    const d = one('The load-in runs from October 29 to November 12, 2026.');
    expect(d.isRange).toBe(true);
    expect(d.iso).toBe('2026-10-29');
    expect(d.endIso).toBe('2026-11-12');
  });

  it('rescues a date that casual parsing swallowed into a time-of-day word', () => {
    // `chrono.en.casual` reads "night on November 20, 2026" as one anchorless blob; the strict
    // re-parse of that span is what recovers the real date.
    expect(isos('Opening night on November 20, 2026.')).toEqual(['2026-11-20']);
  });
});

describe('findDates — locale selection', () => {
  it('finds French dates in a French document with locale auto', () => {
    expect(isos('Le rendu final est attendu le 3 mars 2027.', 'auto')).toEqual(['2027-03-03']);
  });

  it('finds English dates in an English document with locale auto', () => {
    expect(isos('The final hand-in is March 3, 2027.', 'auto')).toEqual(['2027-03-03']);
  });

  it('honours an explicitly forced locale', () => {
    expect(isos('Le rendu final est attendu le 3 mars 2027.', 'fr')).toEqual(['2027-03-03']);
    expect(isos('Le rendu final est attendu le 3 mars 2027.', 'en')).toEqual([]);
  });

  it('reads both languages in a mixed document', () => {
    // A French brief with English hardware dates in it is this project's normal case.
    const text = 'Le vernissage est le 20 novembre 2026.\nLoad-in is on October 29, 2026.';
    expect(isos(text, 'auto')).toEqual(['2026-10-29', '2026-11-20']);
  });
});

describe('findDates — durations are not dates', () => {
  it('ignores a stopwatch duration in English', () => {
    expect(isos('Power on the laser engine and warm up for 20 minutes.')).toEqual([]);
    expect(isos('Run continuous playback for 4 hours non-stop.')).toEqual([]);
  });

  it('ignores a stopwatch duration in French', () => {
    expect(isos('Laisser chauffer pendant 20 minutes.')).toEqual([]);
  });

  it('still reads a real date that carries a time of day', () => {
    expect(isos('Filage le 20 novembre 2026 à 18h30.')).toEqual(['2026-11-20']);
  });

  it('ignores a three-letter word that only looks like a weekday', () => {
    // "SAM GLM" is a Genelec calibration system; the French parser reads SAM as samedi.
    expect(isos('| Subwoofers | Genelec 7380A | 2 | 800W Class D, SAM GLM | Booked |')).toEqual([]);
  });

  it('still reads a weekday written out in full', () => {
    expect(isos('Filage vendredi prochain.')).toEqual(['2026-10-02']);
  });
});

describe('findDates — what is not a commitment', () => {
  it('skips a date inside a fenced code block', () => {
    const text = 'Le plan.\n\n```json\n{ "date": "2027-03-01" }\n```\n\nFin.';
    expect(isos(text)).toEqual([]);
  });

  it('skips a date inside an unclosed fenced code block', () => {
    expect(isos('Note.\n\n```\nrelease 2027-03-01\n')).toEqual([]);
  });

  it('skips a date inside inline code', () => {
    expect(isos('Use the key `snapshot-2027-03-01` for the archive.')).toEqual([]);
  });

  it('skips a date inside a YAML frontmatter block', () => {
    expect(isos('---\ndate: 2020-01-01\ntags: [brief]\n---\n\nRien à signaler ici.')).toEqual([]);
  });

  it('still reads dates written after a frontmatter block', () => {
    expect(isos('---\ndate: 2020-01-01\n---\n\nLe vernissage est le 20 novembre 2026.')).toEqual(['2026-11-20']);
  });

  it('downranks an ISO date sitting inside a link target', () => {
    const plain = one('The deadline is 2026-11-20 sharp.');
    const linked = one('See [the plan](https://x.test/2026-11-20/report.pdf).');
    expect(linked.signals).toContain('in-link');
    expect(linked.confidence).toBeLessThan(plain.confidence);
  });

  it('downranks a relative expression when no reference date is given', () => {
    const found = findDates('The deliverable is due next week.');
    expect(found).toHaveLength(1);
    expect(found[0].signals).toContain('unanchored-relative');
    expect(found[0].confidence).toBeLessThan(0.45);
  });

  it('marks an implausible year instead of trusting it', () => {
    const d = one('The archive freeze is March 3, 2041.');
    expect(d.signals).toContain('implausible-year');
    expect(d.kind).toBe('mention');
    expect(d.confidence).toBeLessThanOrEqual(0.05);
  });

  it('returns nothing for empty or blank text', () => {
    expect(findDates('', { referenceDate: REF })).toEqual([]);
    expect(findDates('   \n\n  ', { referenceDate: REF })).toEqual([]);
  });
});

describe('findDates — commitment signals', () => {
  it('raises a date with a deadline word to kind deadline', () => {
    const d = one('Deadline : le 20 novembre 2026.');
    expect(d.kind).toBe('deadline');
    expect(d.signals).toContain('deadline');
    expect(d.confidence).toBeGreaterThan(0.6);
  });

  it('reads an accented French deadline word', () => {
    const d = one("L'échéance est le 20 novembre 2026.");
    expect(d.kind).toBe('deadline');
    expect(d.signals).toContain('echeance');
  });

  it('reads a venue ritual as a milestone, not a deadline', () => {
    const d = one('Vernissage le 20 novembre 2026.');
    expect(d.kind).toBe('milestone');
    expect(d.signals).toContain('vernissage');
  });

  it('prefers deadline over milestone when both words are present', () => {
    const d = one('Le vernissage est au plus tard le 20 novembre 2026.');
    expect(d.kind).toBe('deadline');
    expect(d.signals).toEqual(expect.arrayContaining(['au-plus-tard', 'vernissage']));
  });

  it('leaves a bare mention as a mention', () => {
    const d = one('Nous avons parlé de cela le 20 novembre 2026.');
    expect(d.kind).toBe('mention');
    expect(d.signals).toEqual([]);
    expect(d.confidence).toBeLessThan(0.6);
  });

  it('carries the sentence the date came from, with the match still inside it', () => {
    const d = one('## Production\nLa **remise** du rendu final est le 20 novembre 2026.');
    expect(d.sentence).toContain(d.text);
    expect(d.sentence).not.toContain('**');
    expect(d.sentence).not.toContain('##');
  });
});

describe('findDates — deduplication and ordering', () => {
  it('keeps the strongest occurrence of a repeated date and records the other sentence', () => {
    const found = findDates(
      'Une réunion le 20 novembre 2026.\nDeadline de livraison : le 20 novembre 2026.',
      { referenceDate: REF }
    );
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('deadline');
    expect(found[0].otherSentences).toEqual(['Une réunion le 20 novembre 2026.']);
  });

  it('does not merge a range with a plain date that shares its start', () => {
    const found = findDates('Montage du 18 au 20 novembre 2026. Rangement le 18 novembre 2026.', {
      referenceDate: REF,
    });
    // Same calendar start, different entries; within a day they stay in document order.
    expect(found.map((d) => [d.iso, d.endIso])).toEqual([
      ['2026-11-18', '2026-11-20'],
      ['2026-11-18', undefined],
    ]);
  });

  it('returns findings in calendar order', () => {
    expect(
      isos('Rendu le 12 novembre 2026, vernissage le 20 novembre 2026, bilan le 5 octobre 2026.')
    ).toEqual(['2026-10-05', '2026-11-12', '2026-11-20']);
  });

  it('reports the offset of the match inside the document', () => {
    const text = 'Note.\nLe vernissage est le 20 novembre 2026.';
    const d = one(text);
    expect(text.slice(d.offset, d.offset + d.text.length)).toBe(d.text);
  });
});

describe('the signal table', () => {
  it('is exported with unique ids and non-empty patterns', () => {
    const ids = SIGNALS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SIGNALS.every((s) => s.patterns.length > 0 && s.weight > 0)).toBe(true);
  });

  it('matches case- and accent-insensitively', () => {
    expect(matchSignals('ÉCHÉANCE ferme').map((h) => h.id)).toContain('echeance');
    expect(matchSignals("Jusqu’au 20").map((h) => h.id)).toContain('jusquau');
  });

  it('does not match a signal word buried inside a longer word', () => {
    expect(matchSignals('We produce the artwork').map((h) => h.id)).not.toContain('due');
  });

  it('normalises accents and apostrophes without changing the words', () => {
    expect(normalizeForSignals("Échéance — jusqu’au")).toBe("echeance — jusqu'au");
  });
});

describe('sentenceAround', () => {
  it('stops at a newline', () => {
    const text = 'Première ligne.\nLe 20 novembre 2026 est retenu.\nTroisième ligne.';
    expect(sentenceAround(text, text.indexOf('20 novembre'), '20 novembre 2026'.length)).toBe(
      'Le 20 novembre 2026 est retenu.'
    );
  });

  it('trims a long paragraph around the match and keeps it visible', () => {
    const filler = 'contexte '.repeat(60);
    const text = `${filler}le 20 novembre 2026 ${filler}`;
    const s = sentenceAround(text, text.indexOf('20 novembre'), '20 novembre 2026'.length);
    expect(s.length).toBeLessThanOrEqual(242);
    expect(s).toContain('20 novembre 2026');
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
  });
});
