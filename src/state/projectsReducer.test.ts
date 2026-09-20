import { describe, expect, it } from 'vitest';
import type { Milestone, Phase, Project, Task } from '../types';
import { HISTORY_CAP, computeProjectHealth, projectsActions as A, projectsReducer as reduce, isDay, shiftDay } from './projectsReducer';

const AT = '2026-09-20T10:00:00.000Z';
const actor = { id: 'user-1', name: 'Lead', avatar: 'data:,' };
const ctx = (projectId = 'p1', at = AT) => ({ projectId, actor, at });

function task(over: Partial<Task>): Task {
  return {
    id: 't',
    projectId: 'p1',
    phaseId: 'ph1',
    title: 'Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'user-1',
    startDate: '2026-10-01',
    dueDate: '2026-10-10',
    estimatedHours: 8,
    dependencies: [],
    deliverables: [],
    checklist: [],
    tags: [],
    ...over,
  };
}

function phase(over: Partial<Phase>): Phase {
  return { id: 'ph', name: 'Phase', color: '#3B82F6', startDate: '2026-10-01', endDate: '2026-10-31', order: 1, bufferDays: 0, isCriticalPath: false, ...over };
}

function milestone(over: Partial<Milestone>): Milestone {
  return { id: 'm', title: 'Milestone', targetDate: '2026-11-15', isHardDeadline: true, completed: false, description: '', deliverableCount: 0, ...over };
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    workspaceId: 'ws-1',
    title: 'Sample',
    clientName: 'Client',
    description: '',
    status: 'on-track',
    targetDeliveryDate: '2026-11-20',
    startDate: '2026-09-15',
    phases: [phase({ id: 'ph1', order: 1 }), phase({ id: 'ph2', order: 2, startDate: '2026-11-01', endDate: '2026-11-18' })],
    tasks: [
      task({ id: 't1', phaseId: 'ph1' }),
      task({ id: 't2', phaseId: 'ph1', dependencies: ['t1'], startDate: '2026-10-11', dueDate: '2026-10-20' }),
      task({ id: 't3', phaseId: 'ph2', startDate: '2026-11-02', dueDate: '2026-11-15', status: 'done' }),
    ],
    milestones: [milestone({ id: 'm1' })],
    documents: [{ id: 'd1', title: 'Brief', path: 'brief.md', content: '# Brief', lastModified: AT, lastModifiedBy: 'Lead', tags: [] }],
    history: [],
    comments: [],
    clarificationQuestions: [{ id: 'q1', question: 'Q?', reason: '', suggestedOptions: ['A'], resolved: false }],
    retroplanningScore: 0,
    tags: [],
    ...over,
  };
}

const state = () => [project()];

describe('atomic mutations + history', () => {
  it('addTask writes the task and its history entry in one step', () => {
    const next = reduce(state(), A.addTask(ctx(), task({ id: 't4', title: 'New task' })));
    const p = next[0];
    expect(p.tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(p.tasks[3].projectId).toBe('p1');
    expect(p.history).toHaveLength(1);
    expect(p.history[0]).toMatchObject({ actionType: 'create', targetType: 'task', targetTitle: 'New task', userId: 'user-1', userName: 'Lead', timestamp: AT });
    expect(p.history[0].id).toMatch(/^hist-/);
  });

  it('two actions in a row keep both history entries (the lost ai_restructure bug)', () => {
    let s = reduce(state(), A.applyAiStructure(ctx(), { tasks: [{ title: 'AI task' }] }, { replace: false }));
    s = reduce(s, A.saveDocument(ctx(), { ...s[0].documents[0], content: 'changed' }));
    expect(s[0].history.map((h) => h.actionType)).toEqual(['update', 'ai_restructure']);
    expect(s[0].documents[0].content).toBe('changed');
    expect(s[0].tasks).toHaveLength(4);
  });

  it('setStatus records a diff and is a no-op for the same status', () => {
    const s = reduce(state(), A.setTaskStatus(ctx(), 't1', 'in-progress'));
    expect(s[0].tasks[0].status).toBe('in-progress');
    expect(s[0].history[0].diff).toEqual({ field: 'status', oldVal: 'todo', newVal: 'in-progress' });
    const same = reduce(s, A.setTaskStatus(ctx(), 't1', 'in-progress'));
    expect(same).toBe(s);
  });

  it('deleteTask also drops dependency references to it', () => {
    const s = reduce(state(), A.deleteTask(ctx(), 't1'));
    expect(s[0].tasks.map((t) => t.id)).toEqual(['t2', 't3']);
    expect(s[0].tasks[0].dependencies).toEqual([]);
    expect(s[0].history[0].actionType).toBe('delete');
  });

  it('returns the same array for an unknown project or a no-op', () => {
    const s = state();
    expect(reduce(s, A.deleteTask(ctx('nope'), 't1'))).toBe(s);
    expect(reduce(s, A.deleteTask(ctx(), 'missing'))).toBe(s);
    expect(reduce(s, A.toggleChecklistItem(ctx(), 'missing', 'c'))).toBe(s);
  });

  it('toggleChecklistItem flips only the item', () => {
    const s0 = [project({ tasks: [task({ id: 't1', checklist: [{ id: 'c1', text: 'a', completed: false }, { id: 'c2', text: 'b', completed: false }] })] })];
    const s = reduce(s0, A.toggleChecklistItem(ctx(), 't1', 'c2'));
    expect(s[0].tasks[0].checklist.map((c) => c.completed)).toEqual([false, true]);
  });

  it('project/create prepends and stamps a creation entry; project/delete removes', () => {
    const s = reduce(state(), A.createProject(ctx('p2'), project({ id: 'p2', title: 'Second' })));
    expect(s.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(s[0].history[0]).toMatchObject({ actionType: 'create', targetType: 'project' });
    expect(reduce(s, A.deleteProject(ctx('p2'))).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('setTargetDeliveryDate', () => {
  it('anchor-only changes the target and says the schedule was not moved', () => {
    const s = reduce(state(), A.setTargetDeliveryDate(ctx(), '2026-11-25', 'anchor-only'));
    const p = s[0];
    expect(p.targetDeliveryDate).toBe('2026-11-25');
    expect(p.phases[0].startDate).toBe('2026-10-01');
    expect(p.tasks[0].dueDate).toBe('2026-10-10');
    expect(p.milestones[0].targetDate).toBe('2026-11-15');
    expect(p.history[0].description).toBe('Target date changed from 2026-11-20 to 2026-11-25; schedule not moved.');
    expect(p.history[0].diff).toEqual({ field: 'targetDeliveryDate', oldVal: '2026-11-20', newVal: '2026-11-25' });
  });

  it('shift-all moves every phase, task, milestone and the start date by the delta', () => {
    const s = reduce(state(), A.setTargetDeliveryDate(ctx(), '2026-11-25', 'shift-all'));
    const p = s[0];
    expect(p.targetDeliveryDate).toBe('2026-11-25');
    expect(p.startDate).toBe('2026-09-20');
    expect(p.phases.map((x) => [x.startDate, x.endDate])).toEqual([
      ['2026-10-06', '2026-11-05'],
      ['2026-11-06', '2026-11-23'],
    ]);
    expect(p.tasks.map((t) => [t.startDate, t.dueDate])).toEqual([
      ['2026-10-06', '2026-10-15'],
      ['2026-10-16', '2026-10-25'],
      ['2026-11-07', '2026-11-20'],
    ]);
    expect(p.milestones[0].targetDate).toBe('2026-11-20');
    expect(p.history[0].description).toBe('Shifted all dates by +5 days (target 2026-11-20 to 2026-11-25).');
  });

  it('shift-all handles negative deltas across month boundaries', () => {
    const s = reduce(state(), A.setTargetDeliveryDate(ctx(), '2026-10-31', 'shift-all'));
    expect(s[0].phases[1].startDate).toBe('2026-10-12');
    expect(s[0].tasks[2].dueDate).toBe('2026-10-26');
    expect(s[0].history[0].description).toBe('Shifted all dates by -20 days (target 2026-11-20 to 2026-10-31).');
  });

  it('rejects invalid dates and no-ops on the same date', () => {
    const s = state();
    expect(reduce(s, A.setTargetDeliveryDate(ctx(), '2026-13-40', 'shift-all'))).toBe(s);
    expect(reduce(s, A.setTargetDeliveryDate(ctx(), '2026-11-20', 'shift-all'))).toBe(s);
  });

  it('date helpers', () => {
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2028-02-29')).toBe(true);
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('not a date', 3)).toBe('not a date');
  });
});

describe('applyAiStructure', () => {
  const raw = {
    phases: [
      { id: 'ai-ph-1', name: 'Concept', startDate: 'bogus', endDate: '2026-10-15', color: 'red' },
      { name: '', endDate: '2026-11-10' },
    ],
    milestones: [{ title: 'Lock', targetDate: '31/12/2026' }, { title: '   ' }],
    tasks: [
      { id: 'ai-t-1', title: 'First', phaseId: 'ai-ph-1', assigneeId: 'ghost', status: 'weird', priority: 'urgent', dueDate: '2026-10-10' },
      { id: 'ai-t-2', title: 'Second', phaseId: 'unknown', dependencies: ['ai-t-1', 'nope', 'ai-t-2'], startDate: '2026-10-01', dueDate: '2026-10-05', checklist: [{ text: 'check' }, { text: '' }] },
      { title: '' },
    ],
    clarificationQuestions: [{ question: 'Why?', suggestedOptions: ['a', 1] }],
  };

  it('replace=true normalises everything and replaces the schedule', () => {
    const s = reduce(state(), A.applyAiStructure(ctx(), raw, { replace: true, knownAssigneeIds: ['user-1', 'user-2'] }));
    const p = s[0];
    expect(p.phases).toHaveLength(2);
    expect(p.phases[0]).toMatchObject({ name: 'Concept', startDate: '2026-10-15', endDate: '2026-10-15', order: 1, color: '#3B82F6', bufferDays: 0 });
    expect(p.phases[1]).toMatchObject({ name: 'Phase 2', startDate: '2026-11-10', endDate: '2026-11-10', order: 2 });
    expect(p.phases[0].id).toMatch(/^phase-/);
    expect(p.phases[0].id).not.toBe('ai-ph-1');

    expect(p.milestones).toHaveLength(1);
    expect(p.milestones[0]).toMatchObject({ title: 'Lock', targetDate: '2026-11-20', completed: false });

    expect(p.tasks).toHaveLength(2);
    const [t1, t2] = p.tasks;
    expect(t1).toMatchObject({ title: 'First', status: 'todo', priority: 'urgent', assigneeId: 'user-1', startDate: '2026-10-10', dueDate: '2026-10-10', projectId: 'p1' });
    expect(t1.phaseId).toBe(p.phases[0].id);
    expect(t2.phaseId).toBe(p.phases[0].id); // unknown phase -> first phase
    expect(t2.dependencies).toEqual([t1.id]); // remapped, dangling and self dropped
    expect(t2.checklist).toHaveLength(1);
    expect(t2.checklist[0].id).toMatch(/^c-/);
    expect(p.clarificationQuestions).toEqual([expect.objectContaining({ question: 'Why?', suggestedOptions: ['a'], resolved: false })]);
    expect(p.history[0].actionType).toBe('ai_restructure');
    expect(p.history[0].description).toContain('replacing');
  });

  it('replace=false merges: existing entities stay, new ones get fresh ids and continue the phase order', () => {
    const s = reduce(state(), A.applyAiStructure(ctx(), raw, { replace: false, knownAssigneeIds: ['user-1'] }));
    const p = s[0];
    expect(p.phases.map((x) => x.id).slice(0, 2)).toEqual(['ph1', 'ph2']);
    expect(p.phases).toHaveLength(4);
    expect(p.phases.map((x) => x.order)).toEqual([1, 2, 3, 4]);
    expect(p.tasks.map((t) => t.id).slice(0, 3)).toEqual(['t1', 't2', 't3']);
    expect(p.tasks).toHaveLength(5);
    expect(p.milestones).toHaveLength(2);
    expect(p.clarificationQuestions).toHaveLength(2);
    expect(p.history[0].description).toContain('merged');
  });

  it('accepts garbage without throwing', () => {
    const s = reduce(state(), A.applyAiStructure(ctx(), { phases: 'x', tasks: [null, 3], milestones: {} } as never, { replace: true }));
    expect(s[0].phases).toEqual([]);
    expect(s[0].tasks).toEqual([]);
  });
});

describe('history cap', () => {
  it(`keeps the newest ${HISTORY_CAP} entries`, () => {
    let s = state();
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      s = reduce(s, A.addHistory(ctx(), { actionType: 'update', targetType: 'project', targetTitle: `n${i}`, description: '' }));
    }
    expect(s[0].history).toHaveLength(HISTORY_CAP);
    expect(s[0].history[0].targetTitle).toBe(`n${HISTORY_CAP + 4}`);
    expect(s[0].history[HISTORY_CAP - 1].targetTitle).toBe('n5');
  });
});

describe('deletePhase', () => {
  it('moves its tasks to the first remaining phase by order', () => {
    const s0 = [project({ phases: [phase({ id: 'ph1', order: 2 }), phase({ id: 'ph2', order: 1 }), phase({ id: 'ph3', order: 3 })] })];
    const s = reduce(s0, A.deletePhase(ctx(), 'ph2'));
    expect(s[0].phases.map((p) => p.id)).toEqual(['ph1', 'ph3']);
    expect(s[0].tasks.find((t) => t.id === 't3')?.phaseId).toBe('ph1');
    expect(s[0].history[0].description).toContain('1 task(s) moved');
  });

  it("sets phaseId to '' when no phase remains", () => {
    const s0 = [project({ phases: [phase({ id: 'ph1' })], tasks: [task({ id: 't1', phaseId: 'ph1' })] })];
    const s = reduce(s0, A.deletePhase(ctx(), 'ph1'));
    expect(s[0].phases).toEqual([]);
    expect(s[0].tasks[0].phaseId).toBe('');
  });
});

describe('computeProjectHealth', () => {
  it('derives real numbers from dates', () => {
    const h = computeProjectHealth(project(), '2026-10-15');
    expect(h.daysRemaining).toBe(36);
    expect(h.overdueTasks).toBe(1); // t1 due 2026-10-10, still todo; t3 is done
    expect(h.tasksDone).toBe(1);
    expect(h.tasksTotal).toBe(3);
    expect(h.scheduleEndsAfterTarget).toBe(false);
    expect(h.slackDays).toBe(2); // latest date is phase 2 end 2026-11-18
    expect(h.retroplanningScore).toBe(90);
  });

  it('penalises a schedule that overruns the target', () => {
    const p = project({ milestones: [milestone({ id: 'm1', targetDate: '2026-11-28' })] });
    const h = computeProjectHealth(p, '2026-09-01');
    expect(h.scheduleEndsAfterTarget).toBe(true);
    expect(h.slackDays).toBe(-8);
    expect(h.overdueTasks).toBe(0);
    expect(h.retroplanningScore).toBe(70);
  });

  it('clamps to 0 and the reducer keeps the stored score in sync', () => {
    const late = Array.from({ length: 12 }, (_, i) => task({ id: `l${i}`, dueDate: '2026-01-01' }));
    const h = computeProjectHealth(project({ tasks: late }), '2026-09-20');
    expect(h.retroplanningScore).toBe(0);
    const s = reduce([project({ tasks: late })], A.setTaskStatus(ctx(), 'l0', 'done'));
    expect(s[0].retroplanningScore).toBe(computeProjectHealth(s[0], AT).retroplanningScore);
  });
});
