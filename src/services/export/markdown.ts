/**
 * Markdown exports: a human-readable project document, a weekly Gantt table and a Mermaid
 * `gantt` diagram (renders on GitHub, Obsidian, Notion, …).
 */
import { differenceInCalendarDays } from 'date-fns';
import type { Project, User } from '../../types';
import {
  STATUS_LABELS,
  groupTasksByPhase,
  memberName,
  parseDay,
  taskProgress,
  taskTitleOf,
  UNSCHEDULED_PHASE_NAME,
} from './common';
import { buildGanttModel, computeCriticalPath, type GanttGranularity } from './gantt';

/** Options for `projectToMarkdown`. */
export interface MarkdownOptions {
  /** Append a "Timeline" section with the weekly Gantt table and the Mermaid diagram. Default `false`. */
  includeGantt?: boolean;
  /** The day to flag as today in the Gantt table (`YYYY-MM-DD`); defaults to the current date. */
  today?: string;
}

/** Options for `ganttToMarkdownTable`. */
export interface MarkdownGanttOptions {
  /** Column width; default `week`. */
  granularity?: GanttGranularity;
  today?: string;
  members?: readonly User[];
}

/** Escapes text for use inside a Markdown table cell. */
export function mdCell(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

const pct = (ratio: number): string => `${Math.round(ratio * 100)}%`;

/**
 * Full project write-up: header, phases (with buffer/critical flags and progress), milestones,
 * tasks grouped by phase (assignee names, priority, dependencies by title, deliverables, tags,
 * checklist) and the computed critical path.
 */
export function projectToMarkdown(project: Project, members: readonly User[] = [], opts: MarkdownOptions = {}): string {
  const out: string[] = [];
  const groups = groupTasksByPhase(project);

  out.push(`# Project Rétroplanning: ${project.title}`, '');
  out.push(
    `**Client**: ${project.clientName} | **Target Launch**: ${project.targetDeliveryDate} | **Status**: ${project.status}  `
  );
  out.push(`**Buffer Health Score**: ${project.retroplanningScore}%`);
  if (project.description) out.push('', project.description);
  if (project.tags?.length) out.push('', `Tags: ${project.tags.map((t) => `\`${t}\``).join(' ')}`);

  out.push('', '## Phases', '');
  const phaseGroups = groups.filter((g) => g.phase);
  if (phaseGroups.length === 0) out.push('_No phases defined._');
  for (const group of phaseGroups) {
    const phase = group.phase;
    if (!phase) continue;
    const progress =
      group.tasks.length > 0 ? group.tasks.reduce((s, t) => s + taskProgress(t), 0) / group.tasks.length : 0;
    out.push(`### ${phase.name} (${phase.startDate} - ${phase.endDate})`);
    out.push(
      `- Buffer: ${phase.bufferDays} days | Critical Path: ${phase.isCriticalPath ? 'YES' : 'NO'} | Tasks: ${group.tasks.length} | Progress: ${pct(progress)}`
    );
  }

  out.push('', '## Milestones', '');
  const milestones = [...(project.milestones ?? [])].sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? ''));
  if (milestones.length === 0) out.push('_No milestones defined._');
  for (const m of milestones) {
    const deadline = m.isHardDeadline ? ' (hard deadline)' : '';
    out.push(
      `- [${m.completed ? 'x' : ' '}] **${m.targetDate}**${deadline} - ${m.title} (${m.deliverableCount} deliverables): ${m.description}`
    );
  }

  out.push('', '## Tasks & Deliverables', '');
  if ((project.tasks ?? []).length === 0) out.push('_No tasks defined._');
  for (const group of groups) {
    if (group.tasks.length === 0) continue;
    out.push(`### ${group.phase ? group.name : UNSCHEDULED_PHASE_NAME}`, '');
    for (const t of group.tasks) {
      out.push(`#### ${t.title} [${STATUS_LABELS[t.status] ?? t.status}]`);
      out.push(`- **Timeline**: ${t.startDate} to ${t.dueDate} (${t.estimatedHours}h estimated${t.actualHours !== undefined ? `, ${t.actualHours}h actual` : ''})`);
      out.push(`- **Assignee**: ${memberName(members, t.assigneeId) || '—'} | **Priority**: ${t.priority}${t.isCriticalPath ? ' | **Critical path**' : ''}`);
      if (t.dependencies?.length) out.push(`- **Depends on**: ${t.dependencies.map((id) => taskTitleOf(project, id)).join(', ')}`);
      if (t.deliverables?.length) out.push(`- **Deliverables**: ${t.deliverables.join(', ')}`);
      if (t.tags?.length) out.push(`- **Tags**: ${t.tags.join(', ')}`);
      if (t.description) out.push(`- **Notes**: ${t.description}`);
      if (t.checklist?.length) {
        out.push(`- **Checklist** (${pct(taskProgress(t))}):`);
        for (const c of t.checklist) out.push(`  - [${c.completed ? 'x' : ' '}] ${c.text}`);
      }
      out.push('');
    }
  }

  const critical = computeCriticalPath(project);
  if (critical.length > 0) {
    out.push('## Critical Path', '');
    out.push(critical.map((id) => taskTitleOf(project, id)).join(' → '));
    out.push('');
  }

  if (opts.includeGantt) {
    out.push('## Timeline', '');
    out.push(ganttToMarkdownTable(project, { today: opts.today, members }), '');
    out.push('```mermaid', projectToMermaidGantt(project), '```', '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * The Gantt as a Markdown table: one column per week (`W38`, …) by default, `█` in spanned
 * cells, `◆` for milestones. Phase rows are bold, task rows are indented with `↳`.
 */
export function ganttToMarkdownTable(project: Project, opts: MarkdownGanttOptions = {}): string {
  const model = buildGanttModel(project, {
    granularity: opts.granularity ?? 'week',
    today: opts.today,
    members: opts.members,
  });
  const header = ['Item', ...model.columns.map((c) => (c.isTarget ? `**${c.label}**` : c.label))];
  const align = ['---', ...model.columns.map(() => ':-:')];
  const lines = [`| ${header.join(' | ')} |`, `| ${align.join(' | ')} |`];
  for (const row of model.rows) {
    const label =
      row.kind === 'phase' ? `**${mdCell(row.label)}**` : row.kind === 'task' ? `↳ ${mdCell(row.label)}` : `◆ ${mdCell(row.label)}`;
    const glyph = row.kind === 'milestone' ? '◆' : '█';
    const cells = row.cells.map((c) => (c ? glyph : ' '));
    lines.push(`| ${[label, ...cells].join(' | ')} |`);
  }
  return lines.join('\n');
}

/** Strips the characters Mermaid treats as syntax inside titles and section names. */
function mermaidText(text: string): string {
  return text
    .replace(/[:#;]/g, ' -')
    .replace(/%%/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
}

function mermaidId(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(clean) ? `t_${clean}` : clean;
}

/**
 * A Mermaid `gantt` diagram: `dateFormat YYYY-MM-DD`, one section per phase (plus
 * "Unscheduled" when needed), tasks as `title :tags, id, start, <n>d` and milestones in a
 * final "Milestones" section. Tasks with invalid dates are omitted.
 */
export function projectToMermaidGantt(project: Project): string {
  const lines = ['gantt', `    title ${mermaidText(project.title)}`, '    dateFormat YYYY-MM-DD', '    axisFormat %d %b'];
  const critical = new Set(computeCriticalPath(project));

  for (const group of groupTasksByPhase(project)) {
    if (group.tasks.length === 0) continue;
    lines.push(`    section ${mermaidText(group.name)}`);
    for (const t of group.tasks) {
      const start = parseDay(t.startDate);
      const end = parseDay(t.dueDate);
      if (!start || !end) continue;
      const days = Math.max(1, Math.abs(differenceInCalendarDays(end, start)) + 1);
      const tags: string[] = [];
      if (t.status === 'done') tags.push('done');
      else if (t.status === 'in-progress' || t.status === 'in-review') tags.push('active');
      if (t.isCriticalPath ?? critical.has(t.id)) tags.push('crit');
      const startKey = (start <= end ? t.startDate : t.dueDate).slice(0, 10);
      lines.push(`    ${mermaidText(t.title)} :${[...tags, mermaidId(t.id), startKey, `${days}d`].join(', ')}`);
    }
  }

  const milestones = (project.milestones ?? []).filter((m) => parseDay(m.targetDate));
  if (milestones.length > 0) {
    lines.push('    section Milestones');
    for (const m of milestones) {
      const tags = ['milestone', ...(m.completed ? ['done'] : []), ...(m.isHardDeadline ? ['crit'] : [])];
      lines.push(`    ${mermaidText(m.title)} :${[...tags, mermaidId(m.id), m.targetDate.slice(0, 10), '0d'].join(', ')}`);
    }
  }
  return lines.join('\n');
}
