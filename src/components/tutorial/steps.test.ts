import { describe, expect, it } from 'vitest';
import type { MarkdownDoc, Project, Task } from '../../types';
import { EMPTY_FLAGS, TUTORIAL_STEPS, snapshotProject, stepById, stepIndex, type TutorialContext } from './steps';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  projectId: 'p1',
  phaseId: 'ph1',
  title: 'Rig the projectors',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: 'user-1',
  startDate: '2026-10-01',
  dueDate: '2026-10-05',
  estimatedHours: 8,
  dependencies: [],
  deliverables: [],
  checklist: [],
  tags: [],
  ...over,
});

const doc = (over: Partial<MarkdownDoc> = {}): MarkdownDoc => ({
  id: 'd1',
  title: 'Brief',
  path: 'specs/brief.md',
  content: '# Brief',
  tags: [],
  lastModified: '2026-09-20T10:00:00.000Z',
  lastModifiedBy: 'Berenger',
  ...over,
});

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  workspaceId: 'ws-1',
  title: 'Practice',
  clientName: 'Nobody',
  description: '',
  status: 'on-track',
  targetDeliveryDate: '2026-11-20',
  startDate: '2026-09-15',
  phases: [],
  tasks: [task()],
  milestones: [],
  documents: [doc()],
  history: [],
  comments: [],
  clarificationQuestions: [],
  retroplanningScore: 100,
  tags: [],
  ...over,
});

/** Runs one step's predicate against a before/after pair. */
function check(stepId: string, before: Project, after: Project, over: Partial<TutorialContext> = {}, providers: [number, number] = [0, 0]): boolean {
  const step = TUTORIAL_STEPS.find((s) => s.id === stepId);
  if (!step) throw new Error(`no step ${stepId}`);
  return step.isComplete({
    before: snapshotProject(before, providers[0]),
    now: snapshotProject(after, providers[1]),
    flags: EMPTY_FLAGS,
    ...over,
  });
}

describe('tutorial step definitions', () => {
  it('has 8 steps with unique ids, an anchor, a one-line task and a body that explains the feature', () => {
    expect(TUTORIAL_STEPS).toHaveLength(8);
    expect(new Set(TUTORIAL_STEPS.map((s) => s.id)).size).toBe(TUTORIAL_STEPS.length);
    for (const step of TUTORIAL_STEPS) {
      expect(step.anchor.length).toBeGreaterThan(0);
      expect(step.task.trim().length).toBeGreaterThan(0);
      expect(step.task.includes('\n')).toBe(false);
      expect(step.body.length).toBeGreaterThan(60);
      expect(['top', 'bottom', 'left', 'right', 'center']).toContain(step.placement);
    }
  });

  it('marks only the AI step as skippable, and says so in the body', () => {
    expect(TUTORIAL_STEPS.filter((s) => s.optional).map((s) => s.id)).toEqual(['ai']);
    const ai = TUTORIAL_STEPS.find((s) => s.id === 'ai')!;
    expect(ai.body).toMatch(/LlmOnLan/);
    expect(ai.body).toMatch(/heuristic/);
  });

  it('resolves step ids, falling back to the first step for an unknown one', () => {
    expect(stepIndex('tasks')).toBe(3);
    expect(stepIndex(null)).toBe(0);
    expect(stepIndex('nope')).toBe(0);
    expect(stepById('cloud').id).toBe('cloud');
  });
});

describe('completion predicates', () => {
  it('backward-planning: only when the target delivery date changed', () => {
    const before = project();
    expect(check('backward-planning', before, project())).toBe(false);
    expect(check('backward-planning', before, project({ targetDeliveryDate: '2026-12-01' }))).toBe(true);
    // A task edit is not a date change.
    expect(check('backward-planning', before, project({ tasks: [task({ title: 'Other' })] }))).toBe(false);
  });

  it('timeline: only when a task was re-dated', () => {
    const before = project();
    expect(check('timeline', before, project())).toBe(false);
    expect(check('timeline', before, project({ tasks: [task({ startDate: '2026-10-03', dueDate: '2026-10-08' })] }))).toBe(true);
    expect(check('timeline', before, project({ tasks: [task({ dueDate: '2026-10-09' })] }))).toBe(true);
    // Renaming a task moves no dates.
    expect(check('timeline', before, project({ tasks: [task({ title: 'Renamed' })] }))).toBe(false);
  });

  it('dependencies: only when the number of dependency links grew', () => {
    const before = project({ tasks: [task(), task({ id: 't2' })] });
    expect(check('dependencies', before, before)).toBe(false);
    expect(check('dependencies', before, project({ tasks: [task({ dependencies: ['t2'] }), task({ id: 't2' })] }))).toBe(true);
    // Removing one does not complete the step.
    const linked = project({ tasks: [task({ dependencies: ['t2'] }), task({ id: 't2' })] });
    expect(check('dependencies', linked, before)).toBe(false);
  });

  it('tasks: when a task is added, removed, or one of its editable fields changed', () => {
    const before = project();
    expect(check('tasks', before, project())).toBe(false);
    expect(check('tasks', before, project({ tasks: [task(), task({ id: 't2' })] }))).toBe(true);
    expect(check('tasks', before, project({ tasks: [] }))).toBe(true);
    expect(check('tasks', before, project({ tasks: [task({ status: 'in-progress' })] }))).toBe(true);
    expect(check('tasks', before, project({ tasks: [task({ title: 'New title' })] }))).toBe(true);
  });

  it('documents: when a document is created or its content changes', () => {
    const before = project();
    expect(check('documents', before, project())).toBe(false);
    expect(check('documents', before, project({ documents: [doc(), doc({ id: 'd2' })] }))).toBe(true);
    expect(check('documents', before, project({ documents: [doc({ content: '# Brief, edited' })] }))).toBe(true);
    expect(check('documents', before, project({ documents: [doc({ lastModified: '2026-09-21T09:00:00.000Z' })] }))).toBe(true);
  });

  it('ai: only when a provider was added, and never when one is removed', () => {
    const p = project();
    expect(check('ai', p, p, {}, [0, 1])).toBe(true);
    expect(check('ai', p, p, {}, [1, 1])).toBe(false);
    expect(check('ai', p, p, {}, [2, 1])).toBe(false);
  });

  it('cloud and export: only when the corresponding panel is open', () => {
    const p = project();
    expect(check('cloud', p, p, { flags: { ...EMPTY_FLAGS, cloudPanelOpen: true } })).toBe(true);
    expect(check('cloud', p, p)).toBe(false);
    expect(check('export', p, p, { flags: { ...EMPTY_FLAGS, exportMenuOpen: true } })).toBe(true);
    expect(check('export', p, p, { flags: { ...EMPTY_FLAGS, cloudPanelOpen: true } })).toBe(false);
  });
});

describe('snapshotProject', () => {
  it('is stable under task and document reordering', () => {
    const a = project({ tasks: [task(), task({ id: 't2' })], documents: [doc(), doc({ id: 'd2' })] });
    const b = project({ tasks: [task({ id: 't2' }), task()], documents: [doc({ id: 'd2' }), doc()] });
    expect(snapshotProject(a, 0)).toEqual(snapshotProject(b, 0));
  });

  it('tolerates a missing project and still reports the provider count', () => {
    expect(snapshotProject(null, 3).aiProviderCount).toBe(3);
    expect(snapshotProject(null, 0).taskCount).toBe(0);
  });
});
