/**
 * The hardware manifest and media roster, as data.
 *
 * Everything the view shows about these two lists is computed here from the project's own
 * `hardwareItems` / `mediaAssets`. The previous version of the view printed "100% Booked &
 * Confirmed", "12 To-Do Checkpoints" and "6 Days Safety Margin" as literal strings for one
 * particular project; none of those numbers existed anywhere in the data.
 */
import type { HardwareItem, MediaAssetItem } from '../../types';

export const HARDWARE_CATEGORIES: readonly HardwareItem['category'][] = [
  'Projection',
  'Audio',
  'Media Server & Network',
  'Rigging & Power',
];

export const HARDWARE_STATUSES: readonly HardwareItem['status'][] = ['pending', 'booked', 'delivered', 'tested'];

export const HARDWARE_STATUS_LABELS: Readonly<Record<HardwareItem['status'], string>> = {
  pending: 'Pending',
  booked: 'Booked',
  delivered: 'Delivered',
  tested: 'Tested',
};

export const MEDIA_TYPES: readonly MediaAssetItem['type'][] = ['video', 'sound'];

export const MEDIA_STATUSES: readonly MediaAssetItem['status'][] = ['planning', 'in-production', 'rendered', 'approved'];

export const MEDIA_STATUS_LABELS: Readonly<Record<MediaAssetItem['status'], string>> = {
  planning: 'Planning',
  'in-production': 'In production',
  rendered: 'Rendered',
  approved: 'Approved',
};

/** Counts per status, in the declared order, with the zero buckets dropped. */
function tally<S extends string>(values: readonly S[], order: readonly S[], labels: Readonly<Record<S, string>>): string[] {
  const counts = new Map<S, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return order.filter((s) => counts.get(s)).map((s) => `${counts.get(s)} ${labels[s].toLowerCase()}`);
}

export interface HardwareSummary {
  items: number;
  /** Sum of `quantity`, which is the number of physical units. */
  units: number;
  /** e.g. `['3 booked', '1 tested']`. Empty when there is nothing to count. */
  byStatus: string[];
}

export function hardwareSummary(items: readonly HardwareItem[]): HardwareSummary {
  return {
    items: items.length,
    units: items.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0), 0),
    byStatus: tally(
      items.map((i) => i.status),
      HARDWARE_STATUSES,
      HARDWARE_STATUS_LABELS
    ),
  };
}

export interface MediaSummary {
  assets: number;
  video: number;
  sound: number;
  byStatus: string[];
}

export function mediaSummary(assets: readonly MediaAssetItem[]): MediaSummary {
  return {
    assets: assets.length,
    video: assets.filter((a) => a.type === 'video').length,
    sound: assets.filter((a) => a.type === 'sound').length,
    byStatus: tally(
      assets.map((a) => a.status),
      MEDIA_STATUSES,
      MEDIA_STATUS_LABELS
    ),
  };
}

/** Replaces the entry with the same id, or appends it. Never mutates the input. */
export function upsertById<T extends { id: string }>(list: readonly T[], entry: T): T[] {
  const index = list.findIndex((e) => e.id === entry.id);
  if (index === -1) return [...list, entry];
  const next = [...list];
  next[index] = entry;
  return next;
}

export function removeById<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter((entry) => entry.id !== id);
}

/** Blocking problems with a hardware draft; empty means it can be saved. */
export function validateHardware(item: Pick<HardwareItem, 'name' | 'quantity'>): string[] {
  const problems: string[] = [];
  if (!item.name.trim()) problems.push('A name is required.');
  if (!Number.isFinite(item.quantity) || item.quantity < 1) problems.push('Quantity must be 1 or more.');
  return problems;
}

/** Blocking problems with a media draft; empty means it can be saved. */
export function validateMedia(asset: Pick<MediaAssetItem, 'title'>): string[] {
  return asset.title.trim() ? [] : ['A title is required.'];
}
