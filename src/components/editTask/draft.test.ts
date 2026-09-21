import { describe, expect, it } from 'vitest';
import { makeProject, makeTask } from '../../services/export/testFixtures';
import {
  applyDraft,
  draftToNewTask,
  emptyDraft,
  firstPhaseId,
  moveChecklistItem,
  toDraft,
  validateDraft,
} from './draft';

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

const phase = (id: string, order: number) => ({
  id,
  name: `Phase ${order}`,
  color: '#3B82F6',
  startDate: '2026-03-02',
  endDate: '2026-03-10',
  order,
  bufferDays: 0,
  isCriticalPath: false,
});

describe('firstPhaseId', () => {
  it('follows phase order, not array order', () => {
    const p = makeProject({ phases: [phase('late', 3), phase('early', 1)] });
    expect(firstPhaseId(p)).toBe('early');
  });

  it('is empty for a project with no phase', () => {
    expect(firstPhaseId(makeProject())).toBe('');
  });
});

describe('emptyDraft', () => {
  const blank = emptyDraft(makeProject({ phases: [phase('a', 1), phase('b', 2)] }));

  it('invents nothing — no dates, hours, deliverables, checklist, tags or assignee', () => {
    expect(blank.title).toBe('');
    expect(blank.description).toBe('');
    expect(blank.startDate).toBe('');
    expect(blank.dueDate).toBe('');
    expect(blank.estimatedHours).toBe('');
    expect(blank.assigneeId).toBe('');
    expect(blank.deliverables).toEqual([]);
    expect(blank.checklist).toEqual([]);
    expect(blank.tags).toEqual([]);
    expect(blank.dependencies).toEqual([]);
  });

  it('starts in the project\u2019s first phase', () => {
    expect(blank.phaseId).toBe('a');
  });

  it('takes the phase from the project it is given, every time', () => {
    const other = emptyDraft(makeProject({ id: 'other', phases: [phase('z', 1)] }));
    expect(other.phaseId).toBe('z');
  });

  it('cannot be saved as-is: title, dates and hours are all required', () => {
    const v = validateDraft(blank, makeProject());
    expect(v.blocking).toBe(true);
    expect(v.title).toBeTruthy();
    expect(v.dates).toBeTruthy();
    expect(v.hours).toBeTruthy();
  });
});

describe('draftToNewTask', () => {
  const filled = {
    ...emptyDraft(makeProject({ phases: [phase('a', 1)] })),
    title: '  Build the rig  ',
    startDate: '2026-03-03',
    dueDate: '2026-03-05',
    estimatedHours: '6',
    deliverables: ['Rig'],
    tags: ['build'],
  };

  it('trims the title and writes hours as a number', () => {
    const created = draftToNewTask(filled, 'p-42');
    expect(created.title).toBe('Build the rig');
    expect(created.estimatedHours).toBe(6);
  });

  it('carries the project id and the chosen phase', () => {
    const created = draftToNewTask(filled, 'p-42');
    expect(created.projectId).toBe('p-42');
    expect(created.phaseId).toBe('a');
  });

  it('copies arrays rather than sharing them with the draft', () => {
    const created = draftToNewTask(filled, 'p-42');
    created.deliverables.push('extra');
    expect(filled.deliverables).toEqual(['Rig']);
  });

  it('leaves an unassigned task unassigned', () => {
    expect(draftToNewTask(filled, 'p-42').assigneeId).toBe('');
  });
});
