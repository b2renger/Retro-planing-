import { describe, expect, it } from 'vitest';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { backwardPhaseWindows, generateFallbackAnalysis, generateSmartFallbackStructure, isIsoDate, LOCAL_HEURISTIC_LABEL, resolveTargetDate } from './fallbacks';
import type { Task } from '../../types';

const days = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));

describe('backwardPhaseWindows', () => {
  it('ends phase 3 on the target, phase 2 26 days before, phase 1 47 days before, ~3 weeks each', () => {
    const [p1, p2, p3] = backwardPhaseWindows('2027-03-31');
    expect(p3.endDate).toBe('2027-03-31');
    expect(days(p2.endDate, '2027-03-31')).toBe(26);
    expect(days(p1.endDate, '2027-03-31')).toBe(47);
    expect(days(p1.startDate, p1.endDate)).toBe(20);
    expect(days(p1.endDate, p2.startDate)).toBe(1);
    expect(days(p2.endDate, p3.startDate)).toBe(1);
  });
});

describe('resolveTargetDate / isIsoDate', () => {
  it('accepts valid ISO dates and rejects malformed ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28/02/2026')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(resolveTargetDate('2026-12-01')).toBe('2026-12-01');
    expect(isIsoDate(resolveTargetDate('garbage'))).toBe(true);
  });
});

describe('generateSmartFallbackStructure', () => {
  const notes = '# Plan\n- [ ] Storyboard\n- [x] Buy projector\n* Calibrate sound\n- no\nplain line\n- Install on site';

  it('extracts bullet lines into tasks with dates inside their phase and no hardcoded year', () => {
    const r = generateSmartFallbackStructure(notes, '2027-06-15', 'Expo');
    expect(r.targetDeliveryDate).toBe('2027-06-15');
    expect(r.projectTitle).toBe('Expo');
    expect(r.tasks.map((t) => t.title)).toEqual(['Storyboard', 'Buy projector', 'Calibrate sound', 'Install on site']);
    expect(r.tasks[1].status).toBe('done');
    expect(r.phases).toHaveLength(3);
    expect(r.phases[2].endDate).toBe('2027-06-15');
    for (const t of r.tasks) {
      const phase = r.phases.find((p) => p.id === t.phaseId)!;
      expect(isIsoDate(t.startDate) && isIsoDate(t.dueDate)).toBe(true);
      expect(t.startDate).toBe(phase.startDate);
      expect(t.dueDate).toBe(phase.endDate);
      expect(t.dueDate <= '2027-06-15').toBe(true);
    }
    expect(r.milestones.map((m) => m.targetDate)).toEqual([r.phases[0].endDate, r.phases[1].endDate, '2027-06-15']);
    expect(new Set(r.tasks.map((t) => t.id)).size).toBe(r.tasks.length);
    expect(JSON.stringify(r)).not.toContain('2026-');
  });

  it('uses a three-task template when no bullets are found and labels itself as local', () => {
    const r = generateSmartFallbackStructure('just a paragraph', '2027-01-10');
    expect(r.tasks).toHaveLength(3);
    expect(r.tasks[2].dueDate).toBe('2027-01-10');
    expect(r.summary).toContain(LOCAL_HEURISTIC_LABEL);
    expect(r.structuredMarkdown).toContain(LOCAL_HEURISTIC_LABEL);
    expect(r.summary).not.toMatch(/8[- ]day/);
  });

  it('survives an invalid target and empty text', () => {
    const r = generateSmartFallbackStructure('', 'not-a-date');
    expect(isIsoDate(r.targetDeliveryDate)).toBe(true);
    expect(r.phases[2].endDate).toBe(r.targetDeliveryDate);
  });
});

describe('generateFallbackAnalysis', () => {
  const task = (id: string, dueDate: string, deps: string[] = [], critical = false): Task => ({
    id, projectId: 'p', phaseId: 'phase-1', title: id, description: '', status: 'todo', priority: 'medium', assigneeId: '', startDate: dueDate, dueDate,
    estimatedHours: 1, dependencies: deps, deliverables: [], checklist: [], tags: [], isCriticalPath: critical,
  });

  it('flags late tasks and undeclared links without inventing buffers', () => {
    const a = generateFallbackAnalysis([task('b', '2027-02-01'), task('a', '2027-01-01', [], true), task('c', '2027-03-01', ['b'])], '2027-02-15');
    expect(a.criticalPathTaskIds).toEqual(['a']);
    expect(a.bottlenecks.map((b) => b.taskId)).toEqual(['c']);
    expect(a.dependencySuggestions).toEqual([{ sourceTaskId: 'a', targetTaskId: 'b', reason: expect.any(String) }]);
    expect(a.executiveSummary).toContain(LOCAL_HEURISTIC_LABEL);
    expect(a.executiveSummary).not.toMatch(/8-day/);
    expect(a.clarifications[0].resolved).toBe(false);
  });

  it('handles no tasks', () => {
    const a = generateFallbackAnalysis([], '2027-02-15');
    expect(a.criticalPathTaskIds).toEqual([]);
    expect(a.bottlenecks).toEqual([]);
    expect(a.bufferHealthScore).toBe(50);
  });
});
