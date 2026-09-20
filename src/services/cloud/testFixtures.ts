/**
 * Small builders shared by the cloud layer tests (not part of the app bundle).
 */
import type { MarkdownDoc, Project } from '../../types';
import type { CloudFile } from './types';

/** A Markdown document with sensible defaults. */
export function makeDoc(overrides: Partial<MarkdownDoc> = {}): MarkdownDoc {
  return {
    id: 'doc-1',
    title: 'Brief',
    path: 'docs/Brief.md',
    content: '# Brief\n\nHello.',
    lastModified: '2024-01-01T10:00:00.000Z',
    lastModifiedBy: 'user-1',
    tags: ['brief'],
    ...overrides,
  };
}

/** A minimal but complete `Project`. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    workspaceId: 'ws-1',
    title: 'Museum Show',
    clientName: 'Client',
    description: '',
    status: 'on-track',
    targetDeliveryDate: '2024-06-01',
    startDate: '2024-01-01',
    phases: [],
    tasks: [],
    milestones: [],
    documents: [makeDoc()],
    history: [],
    comments: [],
    clarificationQuestions: [],
    retroplanningScore: 50,
    tags: [],
    ...overrides,
  };
}

/** A remote file stub. */
export function makeFile(overrides: Partial<CloudFile> & Pick<CloudFile, 'id' | 'name'>): CloudFile {
  return { isFolder: false, modifiedTime: '2024-01-01T12:00:00.000Z', ...overrides };
}

/** `Response` factory for `fetch` mocks. */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** `Response` factory for text bodies. */
export function textResponse(body: string, status = 200, contentType = 'text/plain'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } });
}

/** Extracts `[url, init]` of the n-th call of a mocked fetch. */
export function fetchCall(mock: { mock: { calls: unknown[][] } }, n = 0): { url: string; init: RequestInit } {
  const call = mock.mock.calls[n];
  if (!call) throw new Error(`fetch was not called ${n + 1} time(s)`);
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}
