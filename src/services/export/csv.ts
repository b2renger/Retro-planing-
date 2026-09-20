/**
 * Tabular views of a project (tasks, phases, milestones) and their RFC 4180 CSV encoding.
 * The table builders are also what the xlsx export feeds into, so both stay in sync.
 */
import type { Project, User } from '../../types';
import { memberName, phaseNameOf, taskTitleOf } from './common';
import { computeCriticalPath } from './gantt';

/** A single table value; dates are `YYYY-MM-DD` strings tagged by their column type. */
export type TableCell = string | number | boolean | null;

/** Column metadata used for both CSV headers and spreadsheet typing. */
export interface TableColumn {
  header: string;
  /** Drives spreadsheet cell typing; CSV always writes the string form. */
  type: 'string' | 'number' | 'date';
  /** Suggested spreadsheet column width in characters. */
  width: number;
}

/** A header row plus data rows. */
export interface Table {
  columns: TableColumn[];
  rows: TableCell[][];
}

/** Options for the CSV encoders. */
export interface CsvOptions {
  /** Prefix the output with a UTF-8 byte-order mark so Excel opens it as UTF-8. Default `true`. */
  bom?: boolean;
  /** Field separator. Default `,`. */
  delimiter?: string;
}

/** UTF-8 byte-order mark. */
export const CSV_BOM = '\uFEFF';

/** Columns of the Tasks table, in order. */
export const TASK_COLUMNS: readonly TableColumn[] = [
  { header: 'Task ID', type: 'string', width: 14 },
  { header: 'Phase', type: 'string', width: 36 },
  { header: 'Title', type: 'string', width: 48 },
  { header: 'Assignee', type: 'string', width: 22 },
  { header: 'Priority', type: 'string', width: 10 },
  { header: 'Status', type: 'string', width: 12 },
  { header: 'Start', type: 'date', width: 12 },
  { header: 'Due', type: 'date', width: 12 },
  { header: 'Estimated Hours', type: 'number', width: 16 },
  { header: 'Actual Hours', type: 'number', width: 13 },
  { header: 'Dependencies', type: 'string', width: 40 },
  { header: 'Deliverables', type: 'string', width: 40 },
  { header: 'Tags', type: 'string', width: 24 },
  { header: 'Critical Path', type: 'string', width: 13 },
  { header: 'Checklist Done/Total', type: 'string', width: 20 },
];

/** Columns of the Phases table, in order. */
export const PHASE_COLUMNS: readonly TableColumn[] = [
  { header: 'Phase ID', type: 'string', width: 14 },
  { header: 'Order', type: 'number', width: 8 },
  { header: 'Name', type: 'string', width: 48 },
  { header: 'Start', type: 'date', width: 12 },
  { header: 'End', type: 'date', width: 12 },
  { header: 'Buffer Days', type: 'number', width: 12 },
  { header: 'Critical Path', type: 'string', width: 13 },
  { header: 'Color', type: 'string', width: 10 },
  { header: 'Tasks', type: 'number', width: 8 },
];

/** Columns of the Milestones table, in order. */
export const MILESTONE_COLUMNS: readonly TableColumn[] = [
  { header: 'Milestone ID', type: 'string', width: 16 },
  { header: 'Title', type: 'string', width: 48 },
  { header: 'Target Date', type: 'date', width: 12 },
  { header: 'Hard Deadline', type: 'string', width: 13 },
  { header: 'Completed', type: 'string', width: 11 },
  { header: 'Deliverables', type: 'number', width: 12 },
  { header: 'Description', type: 'string', width: 60 },
];

const yesNo = (v: boolean): string => (v ? 'YES' : 'NO');

/** Builds the Tasks table (one row per task, in project order). */
export function buildTaskTable(project: Project, members: readonly User[] = []): Table {
  const computed = new Set(computeCriticalPath(project));
  const rows = (project.tasks ?? []).map((t): TableCell[] => {
    const checklist = t.checklist ?? [];
    const done = checklist.filter((c) => c.completed).length;
    const critical = t.isCriticalPath ?? computed.has(t.id);
    return [
      t.id,
      phaseNameOf(project, t.phaseId),
      t.title,
      memberName(members, t.assigneeId),
      t.priority,
      t.status,
      t.startDate,
      t.dueDate,
      t.estimatedHours ?? null,
      t.actualHours ?? null,
      (t.dependencies ?? []).map((id) => taskTitleOf(project, id)).join('; '),
      (t.deliverables ?? []).join('; '),
      (t.tags ?? []).join('; '),
      yesNo(critical),
      `${done}/${checklist.length}`,
    ];
  });
  return { columns: [...TASK_COLUMNS], rows };
}

/** Builds the Phases table (sorted by `order`). */
export function buildPhaseTable(project: Project): Table {
  const rows = [...(project.phases ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((p): TableCell[] => [
      p.id,
      p.order,
      p.name,
      p.startDate,
      p.endDate,
      p.bufferDays,
      yesNo(p.isCriticalPath),
      p.color,
      (project.tasks ?? []).filter((t) => t.phaseId === p.id).length,
    ]);
  return { columns: [...PHASE_COLUMNS], rows };
}

/** Builds the Milestones table (sorted by date). */
export function buildMilestoneTable(project: Project): Table {
  const rows = [...(project.milestones ?? [])]
    .sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? ''))
    .map((m): TableCell[] => [
      m.id,
      m.title,
      m.targetDate,
      yesNo(m.isHardDeadline),
      yesNo(m.completed),
      m.deliverableCount,
      m.description,
    ]);
  return { columns: [...MILESTONE_COLUMNS], rows };
}

/**
 * Quotes a single CSV field per RFC 4180: fields containing the delimiter, a double quote,
 * CR or LF are wrapped in double quotes, with inner quotes doubled.
 */
export function csvEscape(value: TableCell, delimiter = ','): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  const needsQuotes = text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Encodes a table as CSV with `\r\n` line endings (and a BOM unless disabled). */
export function tableToCsv(table: Table, opts: CsvOptions = {}): string {
  const delimiter = opts.delimiter ?? ',';
  const lines = [
    table.columns.map((c) => csvEscape(c.header, delimiter)).join(delimiter),
    ...table.rows.map((row) => row.map((cell) => csvEscape(cell, delimiter)).join(delimiter)),
  ];
  return (opts.bom === false ? '' : CSV_BOM) + lines.join('\r\n') + '\r\n';
}

/** Tasks as CSV (see `TASK_COLUMNS` for the column list). */
export function tasksToCsv(project: Project, members: readonly User[] = [], opts: CsvOptions = {}): string {
  return tableToCsv(buildTaskTable(project, members), opts);
}

/** Milestones as CSV (see `MILESTONE_COLUMNS`). */
export function milestonesToCsv(project: Project, opts: CsvOptions = {}): string {
  return tableToCsv(buildMilestoneTable(project), opts);
}

/** Phases as CSV (see `PHASE_COLUMNS`). */
export function phasesToCsv(project: Project, opts: CsvOptions = {}): string {
  return tableToCsv(buildPhaseTable(project), opts);
}
