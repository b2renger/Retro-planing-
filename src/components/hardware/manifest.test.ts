import { describe, expect, it } from 'vitest';
import type { HardwareItem, MediaAssetItem } from '../../types';
import { hardwareSummary, mediaSummary, removeById, upsertById, validateHardware, validateMedia } from './manifest';

const hw = (over: Partial<HardwareItem> = {}): HardwareItem => ({
  id: 'h1',
  name: 'Projector',
  category: 'Projection',
  quantity: 2,
  specs: '20K lumens',
  status: 'booked',
  ...over,
});

const media = (over: Partial<MediaAssetItem> = {}): MediaAssetItem => ({
  id: 'm1',
  title: 'Loop A',
  type: 'video',
  format: 'ProRes',
  duration: '8:20',
  status: 'planning',
  description: '',
  ...over,
});

describe('hardwareSummary', () => {
  it('counts entries and physical units', () => {
    const s = hardwareSummary([hw(), hw({ id: 'h2', quantity: 3 })]);
    expect(s.items).toBe(2);
    expect(s.units).toBe(5);
  });

  it('lists only the statuses actually present, in workflow order', () => {
    const s = hardwareSummary([hw({ status: 'tested' }), hw({ id: 'h2', status: 'pending' }), hw({ id: 'h3', status: 'pending' })]);
    expect(s.byStatus).toEqual(['2 pending', '1 tested']);
  });

  it('is all zeroes for an empty manifest — no invented percentage', () => {
    expect(hardwareSummary([])).toEqual({ items: 0, units: 0, byStatus: [] });
  });

  it('ignores a non-finite quantity rather than producing NaN units', () => {
    expect(hardwareSummary([hw({ quantity: Number.NaN })]).units).toBe(0);
  });
});

describe('mediaSummary', () => {
  it('splits video and sound and counts statuses', () => {
    const s = mediaSummary([media(), media({ id: 'm2', type: 'sound', status: 'approved' })]);
    expect(s).toMatchObject({ assets: 2, video: 1, sound: 1 });
    expect(s.byStatus).toEqual(['1 planning', '1 approved']);
  });

  it('is empty for an empty roster', () => {
    expect(mediaSummary([])).toEqual({ assets: 0, video: 0, sound: 0, byStatus: [] });
  });
});

describe('upsertById / removeById', () => {
  it('appends an entry whose id is new', () => {
    expect(upsertById([hw()], hw({ id: 'h2' })).map((i) => i.id)).toEqual(['h1', 'h2']);
  });

  it('replaces in place, keeping the order', () => {
    const next = upsertById([hw(), hw({ id: 'h2' })], hw({ id: 'h1', name: 'Renamed' }));
    expect(next.map((i) => i.name)).toEqual(['Renamed', 'Projector']);
  });

  it('never mutates the list it was given', () => {
    const list = [hw()];
    upsertById(list, hw({ id: 'h1', name: 'Renamed' }));
    removeById(list, 'h1');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Projector');
  });

  it('removes by id and ignores an unknown one', () => {
    expect(removeById([hw(), hw({ id: 'h2' })], 'h2').map((i) => i.id)).toEqual(['h1']);
    expect(removeById([hw()], 'nope')).toHaveLength(1);
  });
});

describe('validation', () => {
  it('requires a hardware name and a quantity of at least one', () => {
    expect(validateHardware({ name: ' ', quantity: 2 })).toContain('A name is required.');
    expect(validateHardware({ name: 'Rig', quantity: 0 })).toContain('Quantity must be 1 or more.');
    expect(validateHardware({ name: 'Rig', quantity: 1 })).toEqual([]);
  });

  it('requires a media title', () => {
    expect(validateMedia({ title: '  ' })).toHaveLength(1);
    expect(validateMedia({ title: 'Loop' })).toEqual([]);
  });
});
