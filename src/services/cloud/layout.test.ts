import { describe, expect, it } from 'vitest';
import { docFileName, docIdForCloudFile, parseDoc, parseProjectFile, projectFromCloudFile, serializeDoc, serializeProject, slugify, toProjectFile } from './layout';
import { makeDoc, makeProject } from './testFixtures';

describe('slugify / docFileName', () => {
  it('keeps readable names and strips forbidden characters', () => {
    expect(slugify('Client: Kick/off <v2>?')).toBe('Client Kickoff v2');
    expect(slugify('  spaced   out  ')).toBe('spaced out');
    expect(slugify('***')).toBe('Untitled');
    expect(slugify('..hidden..')).toBe('hidden');
  });

  it('avoids collisions case-insensitively', () => {
    const taken = new Set(['brief.md', 'brief (2).md']);
    expect(docFileName('Brief', taken)).toBe('Brief (3).md');
    expect(docFileName('Brief.md')).toBe('Brief.md');
  });

  it('derives a stable id from a cloud file id', () => {
    expect(docIdForCloudFile('abc')).toBe(docIdForCloudFile('abc'));
    expect(docIdForCloudFile('abc')).toMatch(/^doc-[0-9a-f]{8}$/);
    expect(docIdForCloudFile('abc')).not.toBe(docIdForCloudFile('abd'));
  });
});

describe('serializeDoc / parseDoc', () => {
  it('round-trips id, title, tags, path and content', () => {
    const doc = makeDoc({ id: 'doc-42', title: 'Kickoff: notes "v2"', tags: ['brief', 'client: x', ''], content: '# Hi\n\n---\nnot frontmatter\n' });
    const text = serializeDoc(doc);
    expect(text.startsWith('---\nid: doc-42\ntitle: "Kickoff: notes \\"v2\\""\npath: docs/Brief.md\ntags: [brief, "client: x", ""]\n---\n')).toBe(true);
    const parsed = parseDoc('Kickoff.md', text);
    expect(parsed).toEqual({ id: 'doc-42', title: 'Kickoff: notes "v2"', tags: ['brief', 'client: x'], path: 'docs/Brief.md', content: doc.content });
  });

  it('handles a file without frontmatter (created in the cloud UI)', () => {
    const parsed = parseDoc('Meeting notes.md', '# Meeting\n\nstuff');
    expect(parsed).toEqual({ id: undefined, title: 'Meeting notes', tags: [], content: '# Meeting\n\nstuff' });
  });

  it('accepts CRLF, a BOM, block-list tags and single quotes', () => {
    const text = '﻿---\r\nid: \'d1\'\r\ntitle: Plain\r\ntags:\r\n  - a\r\n  - "b c"\r\n---\r\nbody';
    expect(parseDoc('x.md', text)).toEqual({ id: 'd1', title: 'Plain', tags: ['a', 'b c'], content: 'body' });
  });

  it('falls back to the file name when the frontmatter has no title', () => {
    expect(parseDoc('Fallback.md', '---\nid: d\n---\n').title).toBe('Fallback');
  });

  it('parses empty content after the frontmatter', () => {
    expect(parseDoc('e.md', '---\nid: d\n---').content).toBe('');
  });
});

describe('project.json', () => {
  it('drops document content and caps history at 200 entries', () => {
    const history = Array.from({ length: 250 }, (_, i) => ({
      id: `h${i}`,
      timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
      userId: 'u',
      userName: 'U',
      userAvatar: '',
      actionType: 'update' as const,
      targetType: 'task' as const,
      targetTitle: 't',
      description: 'd',
    }));
    const project = makeProject({ history });
    const file = toProjectFile(project);
    expect(file.history).toHaveLength(200);
    expect(file.history[0].id).toBe('h50');
    expect(file.documents[0]).not.toHaveProperty('content');
    expect(file.documents[0]).toMatchObject({ id: 'doc-1', title: 'Brief', tags: ['brief'] });
    const text = serializeProject(project);
    expect(text).not.toContain('Hello.');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('parses and rebuilds a project with the documents from docs/', () => {
    const project = makeProject({ tasks: [{ id: 't1', projectId: 'proj-1', phaseId: 'p', title: 'T', description: '', status: 'todo', priority: 'low', assigneeId: '', startDate: '', dueDate: '', estimatedHours: 1, dependencies: [], deliverables: [], checklist: [], tags: [] }] });
    const parsed = parseProjectFile(serializeProject(project));
    expect(parsed.tasks).toHaveLength(1);
    const rebuilt = projectFromCloudFile(parsed, [makeDoc({ content: 'from cloud' })]);
    expect(rebuilt.documents[0].content).toBe('from cloud');
    expect(rebuilt.title).toBe('Museum Show');
  });

  it('rejects malformed project files', () => {
    expect(() => parseProjectFile('nope')).toThrow(/valid JSON/);
    expect(() => parseProjectFile('{"title":"x"}')).toThrow(/id or title/);
    expect(parseProjectFile('{"id":"a","title":"b","tags":"oops"}').tags).toEqual([]);
  });
});
