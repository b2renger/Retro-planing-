import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT, MOCK_USERS } from '../../data/mockData';
import { CSV_BOM, MILESTONE_COLUMNS, PHASE_COLUMNS, TASK_COLUMNS, csvEscape, milestonesToCsv, phasesToCsv, tasksToCsv } from './csv';
import { makePhase, makeProject, makeTask } from './testFixtures';

const splitLines = (csv: string): string[] => csv.replace(CSV_BOM, '').split('\r\n').filter((l) => l.length > 0);

describe('csvEscape', () => {
  it('quotes fields containing delimiters, quotes or line breaks', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(12.5)).toBe('12.5');
    expect(csvEscape('a;b', ';')).toBe('"a;b"');
  });
});

describe('tasksToCsv', () => {
  it('starts with a BOM by default, uses CRLF and has one line per task plus the header', () => {
    const csv = tasksToCsv(MEDIA_INSTALLATION_PROJECT, MOCK_USERS);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '').includes('\n')).toBe(false);
    const lines = splitLines(csv);
    expect(lines).toHaveLength(MEDIA_INSTALLATION_PROJECT.tasks.length + 1);
    expect(lines[0]).toBe(TASK_COLUMNS.map((c) => c.header).join(','));
    expect(lines[0].split(',')).toHaveLength(15);
  });

  it('omits the BOM when asked', () => {
    expect(tasksToCsv(MEDIA_INSTALLATION_PROJECT, MOCK_USERS, { bom: false }).startsWith('Task ID')).toBe(true);
  });

  it('resolves assignee names, dependency titles, phase names and checklist counts', () => {
    const lines = splitLines(tasksToCsv(MEDIA_INSTALLATION_PROJECT, MOCK_USERS));
    const b2 = lines.find((l) => l.startsWith('task-b2,'));
    expect(b2).toBeDefined();
    expect(b2).toContain('Sora Chen');
    expect(b2).toContain('Venue Booking & Electrical Power Survey (32A 3-Phase)');
    expect(b2).toContain('"1. Booking & Procurement (Venue, Hardware & Rigging)"');
    expect(b2).toContain('YES');
    expect(b2?.endsWith(',3/3')).toBe(true);
  });

  it('escapes titles with quotes, commas and newlines', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph1', name: 'Phase, one' })],
      tasks: [makeTask({ id: 't1', title: 'He said "go",\nnow', deliverables: ['a', 'b'] })],
    });
    const csv = tasksToCsv(project, [], { bom: false });
    expect(csv).toContain('"Phase, one","He said ""go"",\nnow"');
    expect(csv).toContain('a; b');
  });
});

describe('phasesToCsv / milestonesToCsv', () => {
  it('emit the documented columns and one row per item', () => {
    const phases = splitLines(phasesToCsv(MEDIA_INSTALLATION_PROJECT));
    expect(phases[0].split(',')).toHaveLength(PHASE_COLUMNS.length);
    expect(phases).toHaveLength(MEDIA_INSTALLATION_PROJECT.phases.length + 1);
    expect(phases[1].startsWith('p1-booking,1,')).toBe(true);

    const milestones = splitLines(milestonesToCsv(MEDIA_INSTALLATION_PROJECT));
    expect(milestones[0]).toBe(MILESTONE_COLUMNS.map((c) => c.header).join(','));
    expect(milestones).toHaveLength(MEDIA_INSTALLATION_PROJECT.milestones.length + 1);
    expect(milestones[1]).toContain('m1-booking-done');
  });
});
