import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT, MOCK_USERS } from '../../data/mockData';
import { buildGanttModel } from './gantt';
import { ganttToSvg, svgSize, svgToPngBlob } from './svg';

const TODAY = '2026-10-01';
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('ganttToSvg', () => {
  const svg = ganttToSvg(MEDIA_INSTALLATION_PROJECT, { today: TODAY, members: MOCK_USERS });

  it('produces a standalone SVG document with explicit dimensions', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    const size = svgSize(svg);
    expect(size).not.toBeNull();
    expect(size?.width).toBeGreaterThan(700);
    expect(svg).toContain(`viewBox="0 0 ${size?.width} ${size?.height}"`);
  });

  it('draws one bar per spanned task, one diamond per milestone and the target line', () => {
    const model = buildGanttModel(MEDIA_INSTALLATION_PROJECT, { today: TODAY });
    const spannedTasks = model.rows.filter((r) => r.kind === 'task' && r.cells.includes(1)).length;
    expect(spannedTasks).toBe(MEDIA_INSTALLATION_PROJECT.tasks.length);
    expect(count(svg, '<rect') - count(svg, 'data-kind="task"')).toBeGreaterThan(0); // grid/background rects exist too
    expect(count(svg, 'data-kind="task"')).toBe(spannedTasks);
    expect(count(svg, 'data-kind="phase"')).toBe(MEDIA_INSTALLATION_PROJECT.phases.length);
    expect(count(svg, 'data-kind="milestone"')).toBe(MEDIA_INSTALLATION_PROJECT.milestones.length);
    expect(count(svg, 'data-kind="target"')).toBe(1);
    expect(count(svg, 'data-kind="today"')).toBe(1);
    expect(count(svg, 'data-kind="weekend"')).toBe(model.columns.filter((c) => c.isWeekend).length);
    expect(svg).toContain('data-id="task-b1"');
  });

  it('escapes text and honours the width and theme options', () => {
    expect(svg).toContain('Echoes &amp; Light');
    expect(svg).not.toContain('Echoes & Light');
    expect(svg).toContain('fill="#ffffff" data-kind="background"');
    const dark = ganttToSvg(MEDIA_INSTALLATION_PROJECT, { today: TODAY, theme: 'dark', width: 1000 });
    expect(dark).toContain('fill="#0f172a" data-kind="background"');
    expect(svgSize(dark)?.width).toBe(1000);
  });

  it('omits the target line when the target date is outside the visible range', () => {
    const clipped = ganttToSvg(MEDIA_INSTALLATION_PROJECT, { today: TODAY, from: '2026-09-14', to: '2026-10-10' });
    expect(count(clipped, 'data-kind="target"')).toBe(0);
  });
});

describe('svgToPngBlob', () => {
  it('rejects outside a browser', async () => {
    await expect(svgToPngBlob('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')).rejects.toThrow(/browser/);
  });
});
