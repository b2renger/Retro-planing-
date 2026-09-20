import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT, MOCK_USERS } from '../../data/mockData';
import { TASK_COLUMNS } from './csv';
import { buildGanttModel } from './gantt';
import { GANTT_FIRST_DAY_COLUMN, GANTT_HEADER_ROWS, SHEET_NAMES, buildWorkbook, workbookToBytes } from './xlsx';

const TODAY = '2026-10-01';

async function roundTrip(): Promise<ExcelJS.Workbook> {
  const wb = await buildWorkbook(MEDIA_INSTALLATION_PROJECT, MOCK_USERS, { today: TODAY });
  const bytes = await workbookToBytes(wb);
  expect(bytes.byteLength).toBeGreaterThan(1000);
  expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK" zip magic
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(bytes.buffer as ExcelJS.Buffer);
  return loaded;
}

function fillArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  return fill && fill.type === 'pattern' ? fill.fgColor?.argb : undefined;
}

describe('buildWorkbook', () => {
  it('writes every sheet in order and survives a reload', async () => {
    const wb = await roundTrip();
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([...SHEET_NAMES]);
  });

  it('writes the Tasks table with a styled frozen header, autofilter and real dates', async () => {
    const wb = await roundTrip();
    const ws = wb.getWorksheet('Tasks');
    expect(ws).toBeDefined();
    if (!ws) return;
    const headers = TASK_COLUMNS.map((_, i) => ws.getRow(1).getCell(i + 1).value);
    expect(headers).toEqual(TASK_COLUMNS.map((c) => c.header));
    expect(ws.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(fillArgb(ws.getRow(1).getCell(1))).toBe('FFE5E7EB');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.rowCount).toBe(MEDIA_INSTALLATION_PROJECT.tasks.length + 1);

    const first = ws.getRow(2);
    expect(first.getCell(1).value).toBe('task-b1');
    expect(first.getCell(4).value).toBe('Berenger Recoules');
    const start = first.getCell(7).value;
    expect(start).toBeInstanceOf(Date);
    expect((start as Date).toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(first.getCell(7).numFmt).toBe('yyyy-mm-dd');
    expect(first.getCell(9).value).toBe(16);
  });

  it('paints the Gantt with row colours, weekend shading and milestone glyphs', async () => {
    const wb = await roundTrip();
    const ws = wb.getWorksheet('Gantt');
    expect(ws).toBeDefined();
    if (!ws) return;
    const model = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: TODAY });
    const colOf = (date: string): number => GANTT_FIRST_DAY_COLUMN + model.columns.findIndex((c) => c.date === date);
    const rowOf = (id: string): number => GANTT_HEADER_ROWS + 1 + model.rows.findIndex((r) => r.id === id);

    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 2, topLeftCell: 'C3' });
    expect(ws.getCell(1, GANTT_FIRST_DAY_COLUMN).value).toBe('September 2026');
    expect(ws.getCell(2, colOf('2026-09-15')).value).toBe(15);
    expect(ws.getColumn(GANTT_FIRST_DAY_COLUMN).width).toBe(3);

    // task-b1 (phase colour #3B82F6) runs 2026-09-15 → 2026-09-24
    const b1 = rowOf('task-b1');
    expect(fillArgb(ws.getCell(b1, colOf('2026-09-15')))).toBe('FF3B82F6');
    expect(fillArgb(ws.getCell(b1, colOf('2026-09-24')))).toBe('FF3B82F6');
    expect(fillArgb(ws.getCell(b1, colOf('2026-09-14')))).toBeUndefined(); // Monday before the task
    expect(fillArgb(ws.getCell(b1, colOf('2026-09-26')))).toBe('FFF3F4F6'); // Saturday after the task
    expect(String(ws.getCell(b1, 1).value)).toContain('Venue Booking');
    expect(ws.getCell(b1, 2).value).toBe('2026-09-15 → 2026-09-24');

    const phase = rowOf('p1-booking');
    expect(ws.getCell(phase, 1).font?.bold).toBe(true);
    expect(fillArgb(ws.getCell(phase, colOf('2026-10-05')))).toBe('FF3B82F6');

    const opening = rowOf('m4-opening-night');
    expect(ws.getCell(opening, colOf('2026-11-20')).value).toBe('◆');

    const targetCol = colOf('2026-11-20');
    expect(ws.getCell(2, targetCol).border?.left?.color?.argb).toBe('FFDC2626');
    expect(ws.getCell(2, colOf(TODAY)).border?.right?.color?.argb).toBe('FF2563EB');
  });

  it('fills the Summary sheet', async () => {
    const wb = await roundTrip();
    const ws = wb.getWorksheet('Summary');
    expect(ws).toBeDefined();
    if (!ws) return;
    expect(ws.getCell('A1').value).toBe('Project');
    expect(ws.getCell('B1').value).toBe(MEDIA_INSTALLATION_PROJECT.title);
    const keys: string[] = [];
    ws.eachRow((row) => keys.push(String(row.getCell(1).value)));
    expect(keys).toEqual(expect.arrayContaining(['Client', 'Target delivery', 'Tasks', 'Retroplanning score', 'Generated at', 'Critical path']));
    expect(ws.getCell('B5').value).toBeInstanceOf(Date);
  });
});
