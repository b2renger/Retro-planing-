import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT, MOCK_USERS } from '../../data/mockData';
import { buildGanttModel, computeCriticalPath } from './gantt';
import { makeMilestone, makePhase, makeProject, makeTask } from './testFixtures';

const TODAY = '2026-10-01';

describe('buildGanttModel', () => {
  it('covers the padded range from the earliest start to the target delivery date', () => {
    const model = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: TODAY });
    expect(model.from).toBe('2026-09-13'); // 2026-09-15 minus 2 padding days
    expect(model.to).toBe('2026-11-22'); // target 2026-11-20 plus 2 padding days
    expect(model.columns[0].date).toBe(model.from);
    expect(model.columns[model.columns.length - 1].date).toBe(model.to);
    expect(model.columns).toHaveLength(71);
    const target = model.columns.filter((c) => c.isTarget);
    expect(target).toHaveLength(1);
    expect(target[0].date).toBe('2026-11-20');
    expect(model.columns.find((c) => c.isToday)?.date).toBe(TODAY);
    expect(model.warnings).toEqual([]);
  });

  it('flags weekends and labels days by day-of-month', () => {
    const model = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: TODAY });
    const byDate = new Map(model.columns.map((c) => [c.date, c]));
    expect(byDate.get('2026-09-19')?.isWeekend).toBe(true); // Saturday
    expect(byDate.get('2026-09-20')?.isWeekend).toBe(true); // Sunday
    expect(byDate.get('2026-09-21')?.isWeekend).toBe(false); // Monday
    expect(byDate.get('2026-09-21')?.label).toBe('21');
  });

  it('marks exactly the spanned cells of a 3-day task', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph1' })],
      tasks: [makeTask({ id: 't1', startDate: '2026-03-02', dueDate: '2026-03-04' })],
    });
    const model = buildGanttModel(project, { from: '2026-03-01', to: '2026-03-06', today: TODAY });
    expect(model.columns.map((c) => c.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
    ]);
    const task = model.rows.find((r) => r.id === 't1');
    expect(task?.cells).toEqual([0, 1, 1, 1, 0, 0]);
    expect(task?.start).toBe('2026-03-02');
    expect(task?.end).toBe('2026-03-04');
  });

  it('orders rows phase → its tasks by start → milestones, with unscheduled tasks grouped', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph2', order: 2 }), makePhase({ id: 'ph1', order: 1 })],
      tasks: [
        makeTask({ id: 'late', phaseId: 'ph1', startDate: '2026-03-04', dueDate: '2026-03-05' }),
        makeTask({ id: 'early', phaseId: 'ph1', startDate: '2026-03-02', dueDate: '2026-03-03' }),
        makeTask({ id: 'orphan', phaseId: 'nope' }),
      ],
      milestones: [makeMilestone({ id: 'm1' })],
    });
    const model = buildGanttModel(project, { today: TODAY });
    expect(model.rows.map((r) => `${r.kind}:${r.id}`)).toEqual([
      'phase:ph1',
      'task:early',
      'task:late',
      'phase:ph2',
      'phase:unscheduled',
      'task:orphan',
      'milestone:m1',
    ]);
    expect(model.rows.find((r) => r.id === 'orphan')?.phaseId).toBe('unscheduled');
    const milestone = model.rows[model.rows.length - 1];
    expect(milestone.cells.filter((c) => c === 1)).toHaveLength(1);
    expect(milestone.start).toBe(milestone.end);
  });

  it('skips items with invalid dates and reports a warning', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph1' })],
      tasks: [makeTask({ id: 'ok' }), makeTask({ id: 'bad', startDate: 'not-a-date' }), makeTask({ id: 'feb', dueDate: '2026-02-30' })],
      milestones: [makeMilestone({ id: 'm-bad', targetDate: '' })],
    });
    const model = buildGanttModel(project, { today: TODAY });
    expect(model.rows.map((r) => r.id)).toEqual(['ph1', 'ok']);
    expect(model.warnings).toHaveLength(3);
    const joined = model.warnings.join("\n");
    expect(joined).toContain('(bad) skipped: invalid dates not-a-date');
    expect(joined).toContain('(feb) skipped: invalid dates 2026-03-02 → 2026-02-30');
    expect(joined).toContain('(m-bad) skipped: invalid date');
  });

  it('computes progress from the checklist, or the status when there is none', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph1' })],
      tasks: [
        makeTask({
          id: 'c',
          checklist: [
            { id: '1', text: 'a', completed: true },
            { id: '2', text: 'b', completed: false },
          ],
        }),
        makeTask({ id: 'd', status: 'done' }),
      ],
    });
    const model = buildGanttModel(project, { today: TODAY });
    expect(model.rows.find((r) => r.id === 'c')?.progress).toBe(0.5);
    expect(model.rows.find((r) => r.id === 'd')?.progress).toBe(1);
    expect(model.rows.find((r) => r.id === 'ph1')?.progress).toBe(0.75);
  });

  it('resolves assignee names when members are supplied', () => {
    const model = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: TODAY, members: MOCK_USERS });
    expect(model.rows.find((r) => r.id === 'task-b1')?.assignee).toBe('Berenger Recoules');
    const bare = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: TODAY });
    expect(bare.rows.find((r) => r.id === 'task-b1')?.assignee).toBe('user-1');
  });

  it('builds Monday-based week columns and marks overlapping weeks', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph1' })],
      tasks: [makeTask({ id: 't1', startDate: '2026-03-06', dueDate: '2026-03-10' })], // Fri → Tue
      targetDeliveryDate: '2026-03-20',
    });
    const model = buildGanttModel(project, { granularity: 'week', today: '2026-03-09' });
    expect(model.columns.map((c) => c.date)).toEqual(['2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16']); // Mondays, padded range snapped to weeks
    expect(model.columns.every((c) => !c.isWeekend)).toBe(true);
    expect(model.columns[0].label).toMatch(/^W\d{2}$/);
    const task = model.rows.find((r) => r.id === 't1');
    expect(task?.cells).toEqual([0, 1, 1, 0]);
    expect(model.columns.filter((c) => c.isToday).map((c) => c.date)).toEqual(['2026-03-09']);
    expect(model.columns.filter((c) => c.isTarget).map((c) => c.date)).toEqual(['2026-03-16']);
  });
});

describe('computeCriticalPath', () => {
  it('returns the heaviest dependency chain of a DAG', () => {
    const project = makeProject({
      tasks: [
        makeTask({ id: 'a', estimatedHours: 10 }),
        makeTask({ id: 'b', estimatedHours: 5, dependencies: ['a'] }),
        makeTask({ id: 'c', estimatedHours: 20, dependencies: ['a'] }),
        makeTask({ id: 'd', estimatedHours: 2, dependencies: ['b', 'c', 'ghost'] }),
        makeTask({ id: 'e', estimatedHours: 1 }),
      ],
    });
    expect(computeCriticalPath(project)).toEqual(['a', 'c', 'd']);
  });

  it('terminates on cycles and still returns a path', () => {
    const project = makeProject({
      tasks: [
        makeTask({ id: 'x', estimatedHours: 3, dependencies: ['y'] }),
        makeTask({ id: 'y', estimatedHours: 4, dependencies: ['x'] }),
        makeTask({ id: 'self', estimatedHours: 1, dependencies: ['self'] }),
      ],
    });
    const path = computeCriticalPath(project);
    expect(path.length).toBeGreaterThan(0);
    expect(new Set(path).size).toBe(path.length);
  });

  it('returns an empty path without positive estimates', () => {
    expect(computeCriticalPath(makeProject())).toEqual([]);
    expect(computeCriticalPath(makeProject({ tasks: [makeTask({ id: 'z', estimatedHours: 0 })] }))).toEqual([]);
  });

  it('follows the fixture chain to the opening-night rehearsal', () => {
    const path = computeCriticalPath(MEDIA_INSTALLATION_PROJECT);
    expect(path[0]).toBe('task-b1');
    expect(path[path.length - 1]).toBe('task-r2');
  });
});
