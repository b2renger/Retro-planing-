import { describe, expect, it } from 'vitest';
import type { MarkdownDoc } from '../../types';
import { makeMilestone, makePhase, makeProject } from '../export/testFixtures';
import { findDates } from './dates';
import { suggestFromDocument, titleFromSentence } from './suggestions';

/** Monday 21 September 2026, local time. Nothing here reads the machine clock. */
const TODAY = new Date(2026, 8, 21, 12, 0, 0);

const doc = (content: string, overrides: Partial<MarkdownDoc> = {}): MarkdownDoc => ({
  id: 'doc-1',
  title: 'Brief.md',
  path: 'briefs/Brief.md',
  content,
  lastModified: '2026-09-20T08:30:00Z',
  lastModifiedBy: 'Berenger',
  tags: [],
  ...overrides,
});

const project = (overrides = {}) =>
  makeProject({
    targetDeliveryDate: '2026-11-20',
    startDate: '2026-09-15',
    phases: [makePhase({ id: 'ph1', startDate: '2026-09-15', endDate: '2026-10-30' })],
    ...overrides,
  });

const run = (content: string, p = project()) => suggestFromDocument(doc(content), p, { today: TODAY });

describe('suggestFromDocument — delivery date', () => {
  it('offers to set a deadline that falls after every phase as the target delivery date', () => {
    const s = run('Deadline de livraison : le 5 décembre 2026.').find((x) => x.kind === 'set-delivery-date');
    expect(s).toBeDefined();
    expect(s?.apply).toEqual({ action: 'set-delivery-date', date: '2026-12-05', mode: 'anchor-only' });
    expect(s?.title).toContain('delivery date');
  });

  it('does not offer a delivery date that is already the target', () => {
    const found = run('Deadline de livraison : le 20 novembre 2026.');
    expect(found.filter((s) => s.kind === 'set-delivery-date')).toEqual([]);
  });

  it('does not offer a delivery date for a deadline inside the schedule', () => {
    const found = run('Deadline de livraison : le 1 octobre 2026.');
    expect(found.filter((s) => s.kind === 'set-delivery-date')).toEqual([]);
  });

  it('does not offer a delivery date for a milestone-kind date', () => {
    const found = run('Vernissage le 5 décembre 2026.');
    expect(found.filter((s) => s.kind === 'set-delivery-date')).toEqual([]);
    expect(found.some((s) => s.kind === 'create-milestone')).toBe(true);
  });
});

describe('suggestFromDocument — milestones', () => {
  it('offers a milestone when nothing in the plan lands near the date', () => {
    const s = run('Vernissage le 20 novembre 2026.').find((x) => x.kind === 'create-milestone');
    expect(s?.apply).toMatchObject({
      action: 'create-milestone',
      targetDate: '2026-11-20',
      isHardDeadline: false,
    });
    expect(s?.evidence).toMatchObject({ documentId: 'doc-1', sentence: 'Vernissage le 20 novembre 2026.' });
  });

  it('marks a deadline-kind milestone as a hard deadline', () => {
    const s = run('Remise du rendu final le 20 novembre 2026.').find((x) => x.kind === 'create-milestone');
    expect(s?.apply).toMatchObject({ action: 'create-milestone', isHardDeadline: true });
  });

  it('stays quiet when a milestone already sits within two days', () => {
    const p = project({ milestones: [makeMilestone({ id: 'm1', targetDate: '2026-11-19' })] });
    expect(run('Vernissage le 20 novembre 2026.', p).filter((s) => s.kind === 'create-milestone')).toEqual([]);
  });

  it('still offers one when the nearest milestone is three days away', () => {
    const p = project({ milestones: [makeMilestone({ id: 'm1', targetDate: '2026-11-17' })] });
    expect(run('Vernissage le 20 novembre 2026.', p).some((s) => s.kind === 'create-milestone')).toBe(true);
  });

  it('titles the milestone from the sentence, not from the whole paragraph', () => {
    const s = run('**Target Opening Night:** November 20, 2026').find((x) => x.kind === 'create-milestone');
    expect(s?.apply).toMatchObject({ title: 'Target Opening Night' });
  });
});

describe('suggestFromDocument — warnings', () => {
  it('warns about a commitment past the target delivery date', () => {
    const s = run('Vernissage le 5 décembre 2026.').find((x) => x.kind === 'warning');
    expect(s?.title).toContain('after your delivery date');
    expect(s?.apply).toEqual({ action: 'none' });
  });

  it('warns about a commitment that has already passed', () => {
    const found = run('Deadline de livraison : le 1 septembre 2026.');
    const warning = found.find((s) => s.id.startsWith('overdue:'));
    expect(warning?.kind).toBe('warning');
    expect(warning?.title).toContain('has already passed');
  });

  it('does not warn about a plain mention in the past', () => {
    expect(run('Nous en avons parlé le 1 septembre 2026.')).toEqual([]);
  });
});

describe('suggestFromDocument — what never becomes a suggestion', () => {
  it('ignores a date with no commitment word around it', () => {
    expect(run('La réunion a eu lieu le 25 octobre 2026.')).toEqual([]);
  });

  it('ignores an implausible year even with a deadline word', () => {
    expect(run('Deadline de livraison : le 3 mars 2041.')).toEqual([]);
  });

  it('ignores a date inside a fenced code block', () => {
    expect(run('Deadline.\n\n```\nlivraison 2026-12-05\n```\n')).toEqual([]);
  });

  it('ignores a relative deadline that was never anchored', () => {
    // `suggestFromDocument` always anchors its own parse, so the unanchored case can only arrive
    // through a detection the caller ran without a reference date. It must not become an action.
    const content = 'The deliverable is due next week.';
    const dates = findDates(content);
    expect(dates[0].signals).toContain('unanchored-relative');
    expect(suggestFromDocument(doc(content), project(), { today: TODAY, dates })).toEqual([]);
  });
});

describe('suggestFromDocument — the contract', () => {
  it('always reports heuristic as the source and a confidence in range', () => {
    const found = run('Deadline de livraison : le 5 décembre 2026.');
    expect(found.length).toBeGreaterThan(0);
    for (const s of found) {
      expect(s.source).toBe('heuristic');
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
      expect(s.detail.length).toBeGreaterThan(10);
    }
  });

  it('describes the action as data, so nothing can run by accident', () => {
    const found = run('Deadline de livraison : le 5 décembre 2026.');
    expect(JSON.parse(JSON.stringify(found))).toEqual(found);
    expect(found.every((s) => typeof s.apply === 'object')).toBe(true);
  });

  it('produces the same ids for the same document twice', () => {
    const a = run('Vernissage le 5 décembre 2026.').map((s) => s.id);
    const b = run('Vernissage le 5 décembre 2026.').map((s) => s.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('reuses a detection the caller already ran', () => {
    const content = 'Vernissage le 5 décembre 2026.';
    const dates = findDates(content, { referenceDate: TODAY });
    const found = suggestFromDocument(doc(content), project(), { today: TODAY, dates });
    expect(found).toEqual(run(content));
  });

  it('returns nothing for an empty document', () => {
    expect(run('')).toEqual([]);
  });
});

describe('titleFromSentence', () => {
  it('drops the date and the label punctuation', () => {
    expect(titleFromSentence('Vernissage le 20 novembre 2026.', '20 novembre 2026', 'Brief')).toBe('Vernissage');
  });

  it('keeps only the label of a "Label: value" line', () => {
    expect(titleFromSentence('Installation Load-In: October 29, 2026', 'October 29, 2026', 'Brief')).toBe(
      'Installation Load-In'
    );
  });

  it('keeps the clause that names the event and drops the qualifiers', () => {
    expect(
      titleFromSentence(
        'La remise du dossier technique au lieu est due le 6 novembre 2026, au plus tard.',
        '6 novembre 2026',
        'Brief'
      )
    ).toBe('La remise du dossier technique au lieu est due');
  });

  it('cuts a long sentence at a word boundary', () => {
    const long = `Le ${'très '.repeat(30)}long vernissage le 20 novembre 2026.`;
    const title = titleFromSentence(long, '20 novembre 2026', 'Brief');
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back when nothing usable is left', () => {
    expect(titleFromSentence('20 novembre 2026', '20 novembre 2026', 'Brief')).toBe('Brief');
  });
});
