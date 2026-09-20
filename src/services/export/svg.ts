/**
 * SVG rendering of the Gantt (pure string building, no DOM) and a browser-only PNG rasteriser.
 */
import { format } from 'date-fns';
import type { Project, User } from '../../types';
import { escapeXml, groupTasksByPhase, parseDay } from './common';
import { buildGanttModel, type GanttColumn, type GanttModel } from './gantt';

/** Options for `ganttToSvg`. */
export interface SvgOptions {
  /** Total width in px; defaults to a width that gives every day ~18 px (min 720). */
  width?: number;
  /** Colour theme; default `light`. */
  theme?: 'light' | 'dark';
  /** The day to mark as today (`YYYY-MM-DD`); defaults to the current date. */
  today?: string;
  /** Members used to resolve assignee names in tooltips. */
  members?: readonly User[];
  /** Override the first/last column (`YYYY-MM-DD`). */
  from?: string;
  to?: string;
}

interface Palette {
  bg: string;
  text: string;
  muted: string;
  grid: string;
  weekend: string;
  band: string;
  today: string;
  target: string;
  barText: string;
}

const THEMES: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#ffffff',
    text: '#111827',
    muted: '#6b7280',
    grid: '#e5e7eb',
    weekend: '#f3f4f6',
    band: '#f9fafb',
    today: '#2563eb',
    target: '#dc2626',
    barText: '#ffffff',
  },
  dark: {
    bg: '#0f172a',
    text: '#f1f5f9',
    muted: '#94a3b8',
    grid: '#1e293b',
    weekend: '#162033',
    band: '#131c31',
    today: '#60a5fa',
    target: '#f87171',
    barText: '#ffffff',
  },
};

const PAD = 16;
const LABEL_W = 260;
const TITLE_H = 32;
const HEADER_H = 46;
const ROW_H = 26;
const LEGEND_H = 44;
const DEFAULT_DAY_W = 18;
const FONT_FAMILY = 'Inter, "Segoe UI", Helvetica, Arial, sans-serif';

/** Rough text width for truncation (no DOM to measure with). */
function truncateToWidth(text: string, maxPx: number, fontPx: number): string {
  const perChar = fontPx * 0.56;
  const max = Math.max(1, Math.floor(maxPx / perChar));
  return text.length <= max ? text : text.slice(0, Math.max(1, max - 1)) + '…';
}

function monthRuns(columns: GanttColumn[]): { start: number; end: number; label: string }[] {
  const runs: { start: number; end: number; label: string }[] = [];
  columns.forEach((c, i) => {
    const month = c.date.slice(0, 7);
    const last = runs[runs.length - 1];
    if (last && last.label === month) last.end = i;
    else runs.push({ start: i, end: i, label: month });
  });
  return runs.map((r) => {
    const d = parseDay(columns[r.start].date);
    return { ...r, label: d ? format(d, 'MMMM yyyy') : r.label };
  });
}

function attr(values: Record<string, string | number>): string {
  return Object.entries(values)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? String(Math.round(v * 100) / 100) : escapeXml(v)}"`)
    .join(' ');
}

/**
 * Renders the project's Gantt as a standalone SVG document: day grid with month/day headers,
 * weekend shading, phase bands, coloured task bars (with progress and label), milestone
 * diamonds, today and target-delivery lines, and a legend.
 */
export function ganttToSvg(project: Project, opts: SvgOptions = {}): string {
  const palette = THEMES[opts.theme ?? 'light'];
  const model: GanttModel = buildGanttModel(project, {
    granularity: 'day',
    today: opts.today,
    members: opts.members,
    from: opts.from,
    to: opts.to,
  });
  const n = Math.max(1, model.columns.length);
  const width = Math.max(480, opts.width ?? Math.max(720, LABEL_W + PAD * 2 + n * DEFAULT_DAY_W));
  const gridX = PAD + LABEL_W;
  const gridW = width - gridX - PAD;
  const dayW = gridW / n;
  const headerY = PAD + TITLE_H;
  const gridY = headerY + HEADER_H;
  const rowsH = model.rows.length * ROW_H;
  const gridBottom = gridY + rowsH;
  const height = gridBottom + PAD + LEGEND_H + PAD;
  const colX = (i: number): number => gridX + i * dayW;

  const s: string[] = [];
  s.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ${attr({ width, height, viewBox: `0 0 ${width} ${height}` })} role="img" aria-label="${escapeXml(`Gantt chart: ${project.title}`)}">`
  );
  s.push(`<rect ${attr({ x: 0, y: 0, width, height, fill: palette.bg })} data-kind="background"/>`);
  s.push(`<g ${attr({ 'font-family': FONT_FAMILY, 'font-size': 12, fill: palette.text })}>`);

  // Title
  s.push(
    `<text ${attr({ x: PAD, y: PAD + 18, 'font-size': 16, 'font-weight': 700 })}>${escapeXml(truncateToWidth(project.title, width - PAD * 2 - 220, 16))}</text>`
  );
  s.push(
    `<text ${attr({ x: width - PAD, y: PAD + 18, 'text-anchor': 'end', fill: palette.muted })}>${escapeXml(`${model.from} → ${model.to}`)}</text>`
  );

  // Phase bands, then weekend shading (drawn over bands, under bars)
  model.rows.forEach((row, r) => {
    if (row.kind !== 'phase') return;
    s.push(`<rect ${attr({ x: PAD, y: gridY + r * ROW_H, width: width - PAD * 2, height: ROW_H, fill: palette.band })} data-kind="band"/>`);
  });
  model.columns.forEach((c, i) => {
    if (!c.isWeekend) return;
    s.push(
      `<rect ${attr({ x: colX(i), y: headerY, width: dayW, height: HEADER_H + rowsH, fill: palette.weekend })} data-kind="weekend"/>`
    );
  });

  // Headers: month runs and day numbers
  for (const run of monthRuns(model.columns)) {
    const x0 = colX(run.start);
    const w = (run.end - run.start + 1) * dayW;
    s.push(`<line ${attr({ x1: x0, y1: headerY, x2: x0, y2: gridBottom, stroke: palette.grid, 'stroke-width': 1.5 })}/>`);
    if (w >= 28) {
      s.push(
        `<text ${attr({ x: x0 + w / 2, y: headerY + 16, 'text-anchor': 'middle', 'font-weight': 600 })}>${escapeXml(truncateToWidth(run.label, w - 4, 12))}</text>`
      );
    }
  }
  const labelEvery = dayW >= 12 ? 1 : dayW >= 6 ? 2 : 7;
  model.columns.forEach((c, i) => {
    const d = parseDay(c.date);
    const isMonday = d ? d.getDay() === 1 : false;
    const show = labelEvery === 1 || (labelEvery === 7 ? isMonday : i % labelEvery === 0);
    if (show) {
      const color = c.isTarget ? palette.target : c.isToday ? palette.today : palette.muted;
      s.push(
        `<text ${attr({ x: colX(i) + dayW / 2, y: headerY + HEADER_H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: color, 'font-weight': c.isTarget || c.isToday ? 700 : 400 })}>${escapeXml(c.label)}</text>`
      );
    }
    if (dayW >= 8 || isMonday) {
      s.push(`<line ${attr({ x1: colX(i), y1: gridY, x2: colX(i), y2: gridBottom, stroke: palette.grid, 'stroke-width': 0.5 })}/>`);
    }
  });
  s.push(`<line ${attr({ x1: PAD, y1: gridY, x2: width - PAD, y2: gridY, stroke: palette.grid })}/>`);

  // Rows
  model.rows.forEach((row, r) => {
    const rowY = gridY + r * ROW_H;
    const midY = rowY + ROW_H / 2;
    s.push(`<line ${attr({ x1: PAD, y1: rowY + ROW_H, x2: width - PAD, y2: rowY + ROW_H, stroke: palette.grid, 'stroke-width': 0.5 })}/>`);

    const indent = row.kind === 'task' ? 16 : 0;
    const prefix = row.kind === 'milestone' ? '◆ ' : '';
    const label = truncateToWidth(prefix + row.label, LABEL_W - 12 - indent, 12);
    s.push(
      `<text ${attr({ x: PAD + 6 + indent, y: midY + 4, 'font-weight': row.kind === 'phase' ? 700 : 400, fill: row.kind === 'milestone' ? row.color : palette.text })}>${escapeXml(label)}</text>`
    );

    const first = row.cells.indexOf(1);
    const last = row.cells.lastIndexOf(1);
    if (first < 0) return;
    const x = colX(first);
    const w = (last - first + 1) * dayW;
    const tooltip = `<title>${escapeXml(`${row.label} (${row.start} → ${row.end})${row.assignee ? ` — ${row.assignee}` : ''}${row.status ? ` — ${row.status}` : ''}`)}</title>`;

    if (row.kind === 'phase') {
      s.push(
        `<rect ${attr({ x, y: midY - 4, width: w, height: 8, rx: 2, fill: row.color, opacity: 0.9 })} data-kind="phase" data-id="${escapeXml(row.id)}">${tooltip}</rect>`
      );
    } else if (row.kind === 'milestone') {
      const cx = x + dayW / 2;
      const rad = 7;
      const points = `${cx},${midY - rad} ${cx + rad},${midY} ${cx},${midY + rad} ${cx - rad},${midY}`;
      s.push(
        `<polygon ${attr({ points, fill: row.color, stroke: palette.bg, 'stroke-width': 1 })} data-kind="milestone" data-id="${escapeXml(row.id)}">${tooltip}</polygon>`
      );
    } else {
      const barY = rowY + 5;
      const barH = ROW_H - 10;
      s.push(
        `<rect ${attr({ x, y: barY, width: w, height: barH, rx: 3, fill: row.color })} data-kind="task" data-id="${escapeXml(row.id)}">${tooltip}</rect>`
      );
      const progress = row.progress ?? 0;
      if (progress > 0 && progress < 1) {
        s.push(
          `<rect ${attr({ x, y: barY, width: w * progress, height: barH, rx: 3, fill: '#000000', opacity: 0.25 })} data-kind="progress"/>`
        );
      }
      if (w >= 48) {
        s.push(
          `<text ${attr({ x: x + 6, y: midY + 4, 'font-size': 11, fill: palette.barText })}>${escapeXml(truncateToWidth(row.label, w - 10, 11))}</text>`
        );
      }
    }
  });

  // Today and target lines
  const todayIdx = model.columns.findIndex((c) => c.isToday);
  if (todayIdx >= 0) {
    const x = colX(todayIdx) + dayW / 2;
    s.push(
      `<line ${attr({ x1: x, y1: headerY + HEADER_H - 4, x2: x, y2: gridBottom, stroke: palette.today, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })} data-kind="today"/>`
    );
  }
  const targetIdx = model.columns.findIndex((c) => c.isTarget);
  if (targetIdx >= 0) {
    const x = colX(targetIdx) + dayW / 2;
    s.push(
      `<line ${attr({ x1: x, y1: headerY + 20, x2: x, y2: gridBottom, stroke: palette.target, 'stroke-width': 2 })} data-kind="target"/>`
    );
    const d = parseDay(model.columns[targetIdx].date);
    const anchor = targetIdx > n / 2 ? 'end' : 'start';
    s.push(
      `<text ${attr({ x: x + (anchor === 'end' ? -4 : 4), y: headerY + 28, 'text-anchor': anchor, 'font-size': 10, 'font-weight': 700, fill: palette.target })}>${escapeXml(`Target ${d ? format(d, 'd MMM') : ''}`)}</text>`
    );
  }

  // Legend
  let lx = PAD;
  const ly = gridBottom + PAD + 20;
  const legendItem = (swatch: string, label: string, w: number): void => {
    s.push(swatch);
    s.push(`<text ${attr({ x: lx + 18, y: ly + 4, 'font-size': 11, fill: palette.muted })}>${escapeXml(label)}</text>`);
    lx += 18 + w + 16;
  };
  for (const group of groupTasksByPhase(project)) {
    const label = truncateToWidth(group.name, 150, 11);
    legendItem(
      `<rect ${attr({ x: lx, y: ly - 5, width: 12, height: 12, rx: 2, fill: group.color })} data-kind="legend"/>`,
      label,
      label.length * 6.2
    );
  }
  legendItem(
    `<polygon ${attr({ points: `${lx + 6},${ly - 6} ${lx + 12},${ly} ${lx + 6},${ly + 6} ${lx},${ly}`, fill: palette.text })} data-kind="legend"/>`,
    'Milestone',
    56
  );
  legendItem(
    `<line ${attr({ x1: lx + 6, y1: ly - 6, x2: lx + 6, y2: ly + 6, stroke: palette.target, 'stroke-width': 2 })} data-kind="legend"/>`,
    'Target delivery',
    86
  );
  legendItem(
    `<line ${attr({ x1: lx + 6, y1: ly - 6, x2: lx + 6, y2: ly + 6, stroke: palette.today, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })} data-kind="legend"/>`,
    'Today',
    34
  );

  s.push('</g>', '</svg>');
  return s.join('\n');
}

/** Reads the `width`/`height` attributes of an SVG root element. */
export function svgSize(svg: string): { width: number; height: number } | null {
  const w = /<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/.exec(svg);
  const h = /<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/.exec(svg);
  return w && h ? { width: Number(w[1]), height: Number(h[1]) } : null;
}

/**
 * Rasterises an SVG string to a PNG `Blob` at `scale`× resolution. Browser only (needs
 * `document`, `Image` and canvas); rejects elsewhere.
 */
export async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('svgToPngBlob requires a browser environment');
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode the SVG image'));
      img.src = url;
    });
    const size = svgSize(svg) ?? { width: img.naturalWidth || 800, height: img.naturalHeight || 600 };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
