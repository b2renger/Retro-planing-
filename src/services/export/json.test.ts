import { describe, expect, it } from 'vitest';
import { MEDIA_INSTALLATION_PROJECT } from '../../data/mockData';
import { ProjectJsonError, parseProjectJson, projectToJson } from './json';

describe('projectToJson / parseProjectJson', () => {
  it('round-trips the fixture unchanged', () => {
    const text = projectToJson(MEDIA_INSTALLATION_PROJECT);
    expect(text.startsWith('{\n  "id": "proj-media-installation"')).toBe(true);
    expect(parseProjectJson(text)).toEqual(MEDIA_INSTALLATION_PROJECT);
  });

  it('accepts a { project } envelope', () => {
    const parsed = parseProjectJson(JSON.stringify({ project: MEDIA_INSTALLATION_PROJECT }));
    expect(parsed.id).toBe(MEDIA_INSTALLATION_PROJECT.id);
  });

  it('defaults missing arrays and scalars', () => {
    const parsed = parseProjectJson(JSON.stringify({ id: 'p', title: 'T', tasks: [{ id: 't', title: 'x' }] }));
    expect(parsed.phases).toEqual([]);
    expect(parsed.milestones).toEqual([]);
    expect(parsed.tags).toEqual([]);
    expect(parsed.status).toBe('on-track');
    expect(parsed.retroplanningScore).toBe(0);
    expect(parsed.tasks[0]).toMatchObject({ projectId: 'p', status: 'todo', priority: 'medium', dependencies: [], checklist: [] });
  });

  it('rejects malformed input with a clear message', () => {
    expect(() => parseProjectJson('{not json')).toThrow(ProjectJsonError);
    expect(() => parseProjectJson('[]')).toThrow(/must be an object/);
    expect(() => parseProjectJson('{"id":"p"}')).toThrow(/"\$\.title" must be a non-empty string/);
    expect(() => parseProjectJson('{"id":"p","title":"T","status":"lost"}')).toThrow(/"\$\.status" must be one of/);
    expect(() => parseProjectJson('{"id":"p","title":"T","tasks":[{"id":"t"}]}')).toThrow(/"\$\.tasks\[0\]\.title"/);
    expect(() => parseProjectJson('{"id":"p","title":"T","tasks":[{"id":"t","title":"x","status":"nah"}]}')).toThrow(/tasks\[0\]\.status/);
    expect(() => parseProjectJson('{"id":"p","title":"T","phases":"none"}')).toThrow(/"\$\.phases" must be an array/);
  });
});
