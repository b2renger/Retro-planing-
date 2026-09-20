import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT, MOCK_USERS } from '../../data/mockData';
import { ganttToMarkdownTable, projectToMarkdown, projectToMermaidGantt } from './markdown';
import { makePhase, makeProject, makeTask } from './testFixtures';

describe('projectToMarkdown', () => {
  const md = projectToMarkdown(MEDIA_INSTALLATION_PROJECT, MOCK_USERS);

  it('contains the document sections', () => {
    expect(md.startsWith(`# Project Rétroplanning: ${MEDIA_INSTALLATION_PROJECT.title}`)).toBe(true);
    for (const heading of ['## Phases', '## Milestones', '## Tasks & Deliverables', '## Critical Path']) {
      expect(md).toContain(heading);
    }
    expect(md).toContain('**Buffer Health Score**: 94%');
  });

  it('groups tasks under their phase with assignee names and dependency titles', () => {
    expect(md).toContain('### 1. Booking & Procurement (Venue, Hardware & Rigging)\n\n#### Venue Booking');
    expect(md).toContain('**Assignee**: Sora Chen');
    expect(md).toContain('**Depends on**: Venue Booking & Electrical Power Survey (32A 3-Phase)');
    expect(md).toContain('- [x] Confirm 18m x 12m clear projection wall surface');
    expect(md).not.toContain('\n\n\n');
  });

  it('appends the timeline table and Mermaid block on request', () => {
    const withGantt = projectToMarkdown(MEDIA_INSTALLATION_PROJECT, MOCK_USERS, { includeGantt: true, today: '2026-10-01' });
    expect(withGantt).toContain('## Timeline');
    expect(withGantt).toContain('```mermaid\ngantt');
    expect(md).not.toContain('```mermaid');
  });
});

describe('ganttToMarkdownTable', () => {
  it('renders weekly columns with block cells and milestone diamonds', () => {
    const table = ganttToMarkdownTable(MEDIA_INSTALLATION_PROJECT, { today: '2026-10-01' });
    const lines = table.split('\n');
    expect(lines[0]).toMatch(/^\| Item \| W\d{2} \|/);
    expect(lines[1]).toMatch(/^\| --- \| :-: \|/);
    expect(table).toContain('█');
    expect(table).toContain('| ◆ 🎉 Exhibition Opening Night & VIP Vernissage |');
    expect(table).toContain('**1. Booking & Procurement (Venue, Hardware & Rigging)**');
    expect(table).toContain('↳ Venue Booking');
  });

  it('escapes pipes in labels', () => {
    const project = makeProject({ phases: [makePhase({ id: 'ph1', name: 'A | B' })], tasks: [makeTask({ id: 't', title: 'x|y' })] });
    const table = ganttToMarkdownTable(project);
    expect(table).toContain('**A \\| B**');
    expect(table).toContain('↳ x\\|y');
  });
});

describe('projectToMermaidGantt', () => {
  const mermaid = projectToMermaidGantt(MEDIA_INSTALLATION_PROJECT);

  it('emits a gantt diagram with sections per phase, tasks and milestones', () => {
    expect(mermaid.startsWith('gantt\n')).toBe(true);
    expect(mermaid).toContain('    dateFormat YYYY-MM-DD');
    expect(mermaid).toContain('    section 1. Booking & Procurement (Venue, Hardware & Rigging)');
    expect(mermaid).toContain(':done, crit, task_b1, 2026-09-15, 10d');
    expect(mermaid).toContain('    section Milestones');
    expect(mermaid).toContain(':milestone, done, crit, m1_booking_done, 2026-10-05, 0d');
  });

  it('keeps colons out of titles and skips tasks with invalid dates', () => {
    const project = makeProject({
      phases: [makePhase({ id: 'ph1', name: 'Phase: one' })],
      tasks: [makeTask({ id: 't1', title: 'Do: this; now #1', isCriticalPath: false }), makeTask({ id: 'bad', startDate: 'nope' })],
    });
    const out = projectToMermaidGantt(project);
    expect(out).toContain('section Phase - one');
    expect(out).toContain('Do - this - now -1 :t1, 2026-03-02, 3d');
    expect(out).not.toContain('bad');
  });
});
