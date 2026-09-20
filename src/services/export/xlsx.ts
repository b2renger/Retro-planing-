/**
 * Excel workbook export (ExcelJS). Sheets: Tasks, Phases, Milestones, Gantt, Summary.
 * The Gantt uses cell fills only — no conditional formatting or formulas — so it renders the
 * same in Microsoft Excel, Google Sheets (after import/conversion) and LibreOffice.
 */
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { Project, User } from '../../types';
import { dayKeyToUtcDate, hexToArgb, memberName, parseDay, taskTitleOf } from './common';
import { buildMilestoneTable, buildPhaseTable, buildTaskTable, type Table } from './csv';
import { buildGanttModel, computeCriticalPath, type GanttModel } from './gantt';

/** Options for `buildWorkbook`. */
export interface WorkbookOptions {
  /** The day to outline as today in the Gantt (`YYYY-MM-DD`); defaults to the current date. */
  today?: string;
  /** Override the first/last Gantt column (`YYYY-MM-DD`). */
  from?: string;
  to?: string;
}

/** Sheet names, in workbook order. */
export const SHEET_NAMES = ['Tasks', 'Phases', 'Milestones', 'Gantt', 'Summary'] as const;

/** Column index (1-based) of the first day column in the Gantt sheet. */
export const GANTT_FIRST_DAY_COLUMN = 3;
/** Number of header rows in the Gantt sheet (months, then days). */
export const GANTT_HEADER_ROWS = 2;

const HEADER_FILL = 'FFE5E7EB';
const WEEKEND_FILL = 'FFF3F4F6';
const TODAY_ARGB = 'FF2563EB';
const TARGET_ARGB = 'FFDC2626';
const LINE_ARGB = 'FFD1D5DB';
const DATE_FORMAT = 'yyyy-mm-dd';
const MILESTONE_GLYPH = '◆';

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = (argb: string): ExcelJS.Border => ({ style: 'thin', color: { argb } });

function styleHeaderCell(cell: ExcelJS.Cell): void {
  cell.font = { bold: true };
  cell.fill = solid(HEADER_FILL);
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = { bottom: thin(LINE_ARGB) };
}

function addTableSheet(wb: ExcelJS.Workbook, name: string, table: Table): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = table.columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width }));
  for (const row of table.rows) {
    const values: ExcelJS.CellValue[] = row.map((cell, i) =>
      table.columns[i].type === 'date' && typeof cell === 'string' ? (dayKeyToUtcDate(cell) ?? cell) : cell
    );
    const added = ws.addRow(values);
    table.columns.forEach((c, i) => {
      if (c.type === 'date') added.getCell(i + 1).numFmt = DATE_FORMAT;
    });
  }
  ws.getRow(1).eachCell(styleHeaderCell);
  ws.getRow(1).height = 22;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.columns.length } };
  return ws;
}

function outlineColumn(ws: ExcelJS.Worksheet, col: number, firstRow: number, lastRow: number, argb: string): void {
  const edge: ExcelJS.Border = { style: 'medium', color: { argb } };
  for (let r = firstRow; r <= lastRow; r++) {
    const cell = ws.getCell(r, col);
    cell.border = {
      ...cell.border,
      left: edge,
      right: edge,
      ...(r === firstRow ? { top: edge } : {}),
      ...(r === lastRow ? { bottom: edge } : {}),
    };
  }
}

function addGanttSheet(wb: ExcelJS.Workbook, model: GanttModel): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Gantt', {
    views: [{ state: 'frozen', xSplit: GANTT_FIRST_DAY_COLUMN - 1, ySplit: GANTT_HEADER_ROWS, topLeftCell: 'C3' }],
  });
  const n = model.columns.length;
  const lastRow = GANTT_HEADER_ROWS + model.rows.length;
  const col = (i: number): number => GANTT_FIRST_DAY_COLUMN + i;

  ws.getColumn(1).width = 48;
  ws.getColumn(2).width = 24;
  for (let i = 0; i < n; i++) ws.getColumn(col(i)).width = 3;

  // Corner headers
  ws.getCell(1, 1).value = 'Item';
  ws.getCell(1, 2).value = 'Dates';
  ws.mergeCells(1, 1, 2, 1);
  ws.mergeCells(1, 2, 2, 2);
  styleHeaderCell(ws.getCell(1, 1));
  styleHeaderCell(ws.getCell(1, 2));
  ws.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getCell(1, 2).alignment = { vertical: 'middle', horizontal: 'left' };

  // Month row (merged per month) and day row
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    const current = model.columns[runStart].date.slice(0, 7);
    if (i === n || model.columns[i].date.slice(0, 7) !== current) {
      if (i - 1 > runStart) ws.mergeCells(1, col(runStart), 1, col(i - 1));
      const cell = ws.getCell(1, col(runStart));
      const d = parseDay(model.columns[runStart].date);
      cell.value = d ? format(d, 'MMMM yyyy') : current;
      styleHeaderCell(cell);
      cell.border = { bottom: thin(LINE_ARGB), left: thin(LINE_ARGB) };
      runStart = i;
    }
  }
  model.columns.forEach((c, i) => {
    const cell = ws.getCell(2, col(i));
    cell.value = Number(c.label);
    cell.font = {
      size: 8,
      bold: c.isToday || c.isTarget,
      color: c.isTarget ? { argb: TARGET_ARGB } : c.isToday ? { argb: TODAY_ARGB } : undefined,
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = solid(c.isWeekend ? WEEKEND_FILL : HEADER_FILL);
    cell.border = { bottom: thin(LINE_ARGB) };
  });
  ws.getRow(2).height = 14;

  // Data rows
  model.rows.forEach((row, r) => {
    const rowNo = GANTT_HEADER_ROWS + 1 + r;
    const argb = hexToArgb(row.color);
    const labelCell = ws.getCell(rowNo, 1);
    labelCell.value = row.kind === 'task' ? `    ${row.label}` : row.kind === 'milestone' ? `${MILESTONE_GLYPH} ${row.label}` : row.label;
    labelCell.font = { bold: row.kind === 'phase', italic: row.kind === 'milestone' };
    labelCell.alignment = { vertical: 'middle' };
    const datesCell = ws.getCell(rowNo, 2);
    datesCell.value = row.start === row.end ? row.start : `${row.start} → ${row.end}`;
    datesCell.font = { size: 9, color: { argb: 'FF6B7280' } };
    if (row.kind === 'phase') {
      labelCell.fill = solid('FFF9FAFB');
      datesCell.fill = solid('FFF9FAFB');
    }
    model.columns.forEach((c, i) => {
      const cell = ws.getCell(rowNo, col(i));
      if (row.cells[i] === 1) {
        if (row.kind === 'milestone') {
          cell.value = MILESTONE_GLYPH;
          cell.font = { bold: true, color: { argb } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.fill = solid(argb);
        }
      } else if (c.isWeekend) {
        cell.fill = solid(WEEKEND_FILL);
      }
    });
  });

  // Today / target column outlines (target drawn last so it wins when both coincide)
  const todayIdx = model.columns.findIndex((c) => c.isToday);
  if (todayIdx >= 0) outlineColumn(ws, col(todayIdx), 2, lastRow, TODAY_ARGB);
  const targetIdx = model.columns.findIndex((c) => c.isTarget);
  if (targetIdx >= 0) outlineColumn(ws, col(targetIdx), 2, lastRow, TARGET_ARGB);

  // Legend
  const legendRow = lastRow + 2;
  ws.getCell(legendRow, 1).value = 'Legend';
  ws.getCell(legendRow, 1).font = { bold: true };
  ws.getCell(legendRow + 1, 1).value = `${MILESTONE_GLYPH} milestone · blue outline = today · red outline = target delivery · grey = weekend`;
  ws.getCell(legendRow + 1, 1).font = { size: 9, color: { argb: 'FF6B7280' } };
  if (model.warnings.length > 0) {
    ws.getCell(legendRow + 2, 1).value = `Warnings: ${model.warnings.join(' | ')}`;
    ws.getCell(legendRow + 2, 1).font = { size: 9, color: { argb: TARGET_ARGB } };
  }
  return ws;
}

function addSummarySheet(wb: ExcelJS.Workbook, project: Project, members: readonly User[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Summary');
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 90;
  const tasks = project.tasks ?? [];
  const count = (status: string): number => tasks.filter((t) => t.status === status).length;
  const sum = (pick: (t: Project['tasks'][number]) => number | undefined): number =>
    tasks.reduce((acc, t) => acc + (pick(t) ?? 0), 0);
  const critical = computeCriticalPath(project).map((id) => taskTitleOf(project, id));
  const team = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))].map((id) => memberName(members, id));

  const rows: [string, ExcelJS.CellValue][] = [
    ['Project', project.title],
    ['Client', project.clientName],
    ['Status', project.status],
    ['Start date', dayKeyToUtcDate(project.startDate) ?? project.startDate],
    ['Target delivery', dayKeyToUtcDate(project.targetDeliveryDate) ?? project.targetDeliveryDate],
    ['Retroplanning score', `${project.retroplanningScore}%`],
    ['Phases', (project.phases ?? []).length],
    ['Milestones', `${(project.milestones ?? []).filter((m) => m.completed).length} / ${(project.milestones ?? []).length} completed`],
    ['Tasks', tasks.length],
    ['Tasks done', count('done')],
    ['Tasks in progress', count('in-progress') + count('in-review')],
    ['Tasks blocked', count('blocked')],
    ['Tasks to do', count('todo')],
    ['Estimated hours', sum((t) => t.estimatedHours)],
    ['Actual hours', sum((t) => t.actualHours)],
    ['Critical path', critical.join(' → ')],
    ['Team', team.join(', ')],
    ['Tags', (project.tags ?? []).join(', ')],
    ['Generated at', new Date()],
    ['Generated by', 'RetroPlaningStudio'],
  ];
  rows.forEach(([key, value], i) => {
    const r = ws.getRow(i + 1);
    r.getCell(1).value = key;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = value;
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    if (value instanceof Date) {
      r.getCell(2).numFmt = key === 'Generated at' ? 'yyyy-mm-dd hh:mm' : DATE_FORMAT;
      r.getCell(2).alignment = { horizontal: 'left' };
    }
  });
  ws.getRow(1).getCell(2).font = { bold: true, size: 14 };
  return ws;
}

/**
 * Builds the planning workbook: Tasks / Phases / Milestones tables (bold filled header,
 * frozen header row, autofilter, real date cells), a colour-filled day-by-day Gantt and a
 * Summary sheet.
 */
export async function buildWorkbook(project: Project, members: readonly User[] = [], opts: WorkbookOptions = {}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RetroPlaningStudio';
  wb.created = new Date();
  wb.modified = wb.created;

  addTableSheet(wb, 'Tasks', buildTaskTable(project, members));
  addTableSheet(wb, 'Phases', buildPhaseTable(project));
  addTableSheet(wb, 'Milestones', buildMilestoneTable(project));
  addGanttSheet(wb, buildGanttModel(project, { granularity: 'day', today: opts.today, from: opts.from, to: opts.to, members }));
  addSummarySheet(wb, project, members);
  return wb;
}

/** Serialises a workbook to `.xlsx` bytes (a standalone copy, safe to hand to Blob or upload). */
export async function workbookToBytes(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  const buf: unknown = await wb.xlsx.writeBuffer();
  if (buf instanceof Uint8Array) return new Uint8Array(buf);
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  throw new Error('ExcelJS returned an unexpected buffer type');
}

/** Convenience: `buildWorkbook` + `workbookToBytes`. */
export async function projectToXlsx(project: Project, members: readonly User[] = [], opts: WorkbookOptions = {}): Promise<Uint8Array> {
  return workbookToBytes(await buildWorkbook(project, members, opts));
}
