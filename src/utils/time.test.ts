import { describe, expect, it } from 'vitest';
import { absoluteTime, relativeTime, timestampLabel } from './time';

const NOW = Date.parse('2024-03-01T12:00:00.000Z');

describe('relativeTime', () => {
  it('formats the usual buckets', () => {
    expect(relativeTime('2024-03-01T11:59:56.000Z', NOW)).toBe('just now');
    expect(relativeTime('2024-03-01T11:59:30.000Z', NOW)).toBe('30 s ago');
    expect(relativeTime('2024-03-01T11:56:00.000Z', NOW)).toBe('4 min ago');
    expect(relativeTime('2024-03-01T09:00:00.000Z', NOW)).toBe('3 h ago');
    expect(relativeTime('2024-02-26T12:00:00.000Z', NOW)).toBe('4 d ago');
  });

  it('treats a clock-skewed future timestamp as just now', () => {
    expect(relativeTime('2024-03-01T12:05:00.000Z', NOW)).toBe('just now');
  });

  it('returns null rather than inventing a time', () => {
    expect(relativeTime(undefined, NOW)).toBeNull();
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime('not a date', NOW)).toBeNull();
  });
});

describe('absoluteTime', () => {
  it('renders a full date and time in the given locale', () => {
    expect(absoluteTime('2024-03-01T12:00:00.000Z', 'en-GB')).toMatch(/2024/);
  });

  it('returns null for a value it cannot parse', () => {
    expect(absoluteTime('not a date', 'en-GB')).toBeNull();
    expect(absoluteTime(undefined, 'en-GB')).toBeNull();
  });
});

describe('timestampLabel', () => {
  it('pairs the relative text with an absolute title', () => {
    const label = timestampLabel('2024-03-01T11:56:00.000Z', NOW);
    expect(label?.text).toBe('4 min ago');
    expect(label?.title).toMatch(/2024/);
  });

  it('is null when there is nothing honest to show', () => {
    expect(timestampLabel('', NOW)).toBeNull();
  });
});
