import { describe, expect, it } from 'vitest';
import { makeProject, makeTask } from '../../services/export/testFixtures';
import { applyDraft, moveChecklistItem, toDraft, validateDraft } from './draft';

const project = makeProject({ startDate: '2026-03-02', targetDeliveryDate: '2026-03-20' });
const task = makeTask({
  id: 't1',
  title: 'Wireframes',
  startDate: '2026-03-03',
  dueDate: '2026-03-06',
  estimatedHours: 12,
  dependencies: ['t0'],
  deliverables: ['Figma file'],
  checklist: [
    { id: 'c1', text: 'draft', completed: false },
    { id: 'c2', text: 'review', completed: true },
  ],
  tags: ['design'],
});

describe('toDraft / applyDraft', () => {
  it('round-trips a task through the form without losing a field', () => {
    expect(applyDraft(task, toDraft(task))).toEqual(task);
  });

  it('keeps hours as a string so a half-typed value survives', () => {
    expect(toDraft(task).estimatedHours).toBe('12');
  });

  it('copies arrays instead of sharing them', () => {
    const draft = toDraft(task);
    draft.deliverables.push('extra');
    draft.checklist[0].completed = true;
    expect(task.deliverables).toEqual(['Figma file']);
    expect(task.checklist[0].completed).toBe(false);
  });

  it('trims the title and writes hours back as a number', () => {
    const draft = { ...toDraft(task), title: '  Wireframes v2 ', estimatedHours: '20' };
    const saved = applyDraft(task, draft);
    expect(saved.title).toBe('Wireframes v2');
    expect(saved.estimatedHours).toBe(20);
  });
});

describe('validateDraft', () => {
  it('accepts a sound draft', () => {
    expect(validateDraft(toDraft(task), project)).toEqual({
      title: null,
      dates: null,
      hours: null,
      warning: null,
      blocking: false,
    });
  });

  it('blocks an empty title', () => {
    const result = validateDraft({ ...toDraft(task), title: '   ' }, project);
    expect(result.title).toBeTruthy();
    expect(result.blocking).toBe(true);
  });

  it('blocks a due date before the start date', () => {
    const result = validateDraft({ ...toDraft(task), dueDate: '2026-03-01' }, project);
    expect(result.dates).toContain('before the start date');
    expect(result.blocking).toBe(true);
  });

  it('blocks an unparseable date', () => {
    const result = validateDraft({ ...toDraft(task), startDate: '' }, project);
    expect(result.dates).toContain('real calendar days');
    expect(result.blocking).toBe(true);
  });

  it('blocks hours that are not a number', () => {
    for (const value of ['', 'eight', '-3']) {
      const result = validateDraft({ ...toDraft(task), estimatedHours: value }, project);
      expect(result.hours).toBeTruthy();
      expect(result.blocking).toBe(true);
    }
  });

  it('accepts zero hours', () => {
    expect(validateDraft({ ...toDraft(task), estimatedHours: '0' }, project).hours).toBeNull();
  });

  it('warns but does not block when the dates leave the project window', () => {
    const before = validateDraft({ ...toDraft(task), startDate: '2026-02-20' }, project);
    expect(before.warning).toContain('Outside the project window');
    expect(before.blocking).toBe(false);

    const after = validateDraft({ ...toDraft(task), dueDate: '2026-04-02' }, project);
    expect(after.warning).toContain('Outside the project window');
    expect(after.blocking).toBe(false);
  });

  it('cannot warn about a window the project does not define', () => {
    const undated = makeProject({ startDate: 'nope', targetDeliveryDate: 'nope' });
    expect(validateDraft({ ...toDraft(task), startDate: '2020-01-01', dueDate: '2020-01-02' }, undated).warning).toBeNull();
  });
});

describe('moveChecklistItem', () => {
  const items = [
    { id: 'a', text: 'a', completed: false },
    { id: 'b', text: 'b', completed: false },
    { id: 'c', text: 'c', completed: false },
  ];

  it('swaps with the neighbour', () => {
    expect(moveChecklistItem(items, 1, -1).map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(moveChecklistItem(items, 1, 1).map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move past either end', () => {
    expect(moveChecklistItem(items, 0, -1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveChecklistItem(items, 2, 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveChecklistItem(items, 9, -1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('never mutates the input', () => {
    const copy = [...items];
    moveChecklistItem(items, 0, 1);
    expect(items).toEqual(copy);
  });
});
