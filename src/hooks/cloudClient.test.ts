import { describe, expect, it } from 'vitest';
import { makeDoc, makeFile, makeProject } from '../services/cloud/testFixtures';
import type { SyncState } from '../services/cloud/syncEngine';
import type { CloudSettings } from '../types';
import {
  compareDocuments,
  lastLocalChangeOf,
  linkFromSyncState,
  oauthConfig,
  redirectAdvice,
  relativeTime,
  scopeExplanations,
  summaryLine,
} from './cloudClient';

const SETTINGS: CloudSettings = {
  google: { clientId: '  g-id  ', clientSecret: '  g-secret ' },
  onedrive: { clientId: 'ms-id' },
};

function state(overrides: Partial<SyncState> = {}): SyncState {
  return {
    providerId: 'google',
    rootFolderId: 'root-1',
    projectFolderId: 'proj-folder',
    docsFolderId: 'docs-folder',
    exportsFolderId: 'exports-folder',
    files: {},
    ...overrides,
  };
}

describe('oauthConfig', () => {
  it('trims the google client id and secret', () => {
    expect(oauthConfig(SETTINGS, 'google')).toEqual({ clientId: 'g-id', clientSecret: 'g-secret' });
  });

  it('never carries a secret for onedrive', () => {
    expect(oauthConfig(SETTINGS, 'onedrive')).toEqual({ clientId: 'ms-id' });
  });

  it('drops an empty google secret rather than sending an empty string', () => {
    expect(oauthConfig({ google: { clientId: 'x', clientSecret: '   ' }, onedrive: { clientId: '' } }, 'google')).toEqual({
      clientId: 'x',
      clientSecret: undefined,
    });
  });
});

describe('redirectAdvice', () => {
  it('gives the exact callback URL on the web build', () => {
    const advice = redirectAdvice('google', { desktop: false, origin: 'https://plan.example.com' });
    expect(advice.loopback).toBe(false);
    expect(advice.value).toBe('https://plan.example.com/oauth/callback.html');
    expect(advice.detail).toMatch(/Web application/);
  });

  it('asks for the SPA platform on Microsoft web', () => {
    expect(redirectAdvice('onedrive', { desktop: false, origin: 'http://localhost:5173' }).value).toBe('http://localhost:5173/oauth/callback.html');
    expect(redirectAdvice('onedrive', { desktop: false, origin: 'http://localhost:5173' }).detail).toMatch(/Single-page application/);
  });

  it('describes the per-attempt loopback port on desktop', () => {
    const google = redirectAdvice('google', { desktop: true });
    expect(google.loopback).toBe(true);
    expect(google.value).toBe('http://127.0.0.1');
    expect(google.detail).toMatch(/Desktop app/);
    expect(redirectAdvice('onedrive', { desktop: true }).detail).toMatch(/Mobile and desktop applications/);
  });
});

describe('scopeExplanations', () => {
  it('explains every scope actually requested', () => {
    for (const providerId of ['google', 'onedrive'] as const) {
      const rows = scopeExplanations(providerId);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.meaning).not.toBe('Requested by the provider.');
    }
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2024-03-01T12:00:00.000Z');
  it('formats the usual buckets', () => {
    expect(relativeTime('2024-03-01T11:59:56.000Z', now)).toBe('just now');
    expect(relativeTime('2024-03-01T11:59:30.000Z', now)).toBe('30 s ago');
    expect(relativeTime('2024-03-01T11:56:00.000Z', now)).toBe('4 min ago');
    expect(relativeTime('2024-03-01T09:00:00.000Z', now)).toBe('3 h ago');
    expect(relativeTime('2024-02-26T12:00:00.000Z', now)).toBe('4 d ago');
  });

  it('returns null rather than inventing a time', () => {
    expect(relativeTime(undefined, now)).toBeNull();
    expect(relativeTime('not a date', now)).toBeNull();
  });
});

describe('summaryLine', () => {
  it('lists only non-zero counters', () => {
    expect(summaryLine({ uploaded: 2, downloaded: 0, conflicts: 1, deleted: 0 })).toBe('2 uploaded, 1 conflict');
    expect(summaryLine({ uploaded: 0, downloaded: 0, conflicts: 2, deleted: 3 })).toBe('2 conflicts, 3 deleted');
  });

  it('says so when the plan was empty', () => {
    expect(summaryLine({ uploaded: 0, downloaded: 0, conflicts: 0, deleted: 0 })).toBe('nothing to do');
  });
});

describe('linkFromSyncState', () => {
  it('carries the folder ids and last sync stamp into the project link', () => {
    const link = linkFromSyncState(state({ projectFileId: 'pf', lastSyncAt: '2024-03-01T12:00:00.000Z' }));
    expect(link).toMatchObject({
      providerId: 'google',
      folderId: 'proj-folder',
      docsFolderId: 'docs-folder',
      exportsFolderId: 'exports-folder',
      projectFileId: 'pf',
      lastSyncAt: '2024-03-01T12:00:00.000Z',
    });
  });
});

describe('lastLocalChangeOf', () => {
  it('uses the newest (first) history entry', () => {
    const project = makeProject({
      history: [
        { id: 'h2', timestamp: '2024-03-02T00:00:00.000Z' },
        { id: 'h1', timestamp: '2024-03-01T00:00:00.000Z' },
      ] as never,
    });
    expect(lastLocalChangeOf(project)).toBe('2024-03-02T00:00:00.000Z');
    expect(lastLocalChangeOf(makeProject())).toBeUndefined();
  });
});

describe('compareDocuments', () => {
  it('marks a never-synced document as not uploaded yet', () => {
    const rows = compareDocuments(makeProject(), { remoteDocs: [], remoteProjectFile: null }, state());
    expect(rows).toEqual([
      { key: 'doc-1', name: 'Brief.md', state: 'local-only', modified: '2024-01-01T10:00:00.000Z' },
      { key: 'project.json', name: 'project.json', state: 'local-only', modified: undefined },
    ]);
  });

  it('separates in-sync, newer-here, newer-in-the-cloud and both-changed', () => {
    const project = makeProject({
      documents: [
        makeDoc({ id: 'same', title: 'Same', lastModified: '2024-01-01T10:00:00.000Z' }),
        makeDoc({ id: 'local', title: 'Local', lastModified: '2024-02-01T10:00:00.000Z' }),
        makeDoc({ id: 'remote', title: 'Remote', lastModified: '2024-01-01T10:00:00.000Z' }),
        makeDoc({ id: 'both', title: 'Both', lastModified: '2024-02-01T10:00:00.000Z' }),
      ],
    });
    const syncState = state({
      files: {
        same: { fileId: 'f-same', remoteModified: '2024-01-01T11:00:00.000Z', localModified: '2024-01-01T10:00:00.000Z' },
        local: { fileId: 'f-local', remoteModified: '2024-01-01T11:00:00.000Z', localModified: '2024-01-01T10:00:00.000Z' },
        remote: { fileId: 'f-remote', remoteModified: '2024-01-01T11:00:00.000Z', localModified: '2024-01-01T10:00:00.000Z' },
        both: { fileId: 'f-both', remoteModified: '2024-01-01T11:00:00.000Z', localModified: '2024-01-01T10:00:00.000Z' },
      },
    });
    const snapshot = {
      remoteDocs: [
        makeFile({ id: 'f-same', name: 'same.md', modifiedTime: '2024-01-01T11:00:00.000Z' }),
        makeFile({ id: 'f-local', name: 'local.md', modifiedTime: '2024-01-01T11:00:00.000Z' }),
        makeFile({ id: 'f-remote', name: 'remote.md', modifiedTime: '2024-02-02T11:00:00.000Z' }),
        makeFile({ id: 'f-both', name: 'both.md', modifiedTime: '2024-02-02T11:00:00.000Z' }),
        makeFile({ id: 'f-new', name: 'dropped-in.md', modifiedTime: '2024-02-03T11:00:00.000Z' }),
        makeFile({ id: 'f-ignored', name: 'notes.txt', modifiedTime: '2024-02-03T11:00:00.000Z' }),
      ],
      remoteProjectFile: null,
    };
    const byKey = Object.fromEntries(compareDocuments(project, snapshot, syncState).map((r) => [r.key, r.state]));
    expect(byKey).toEqual({
      same: 'in-sync',
      local: 'local-newer',
      remote: 'remote-newer',
      both: 'both-changed',
      'remote:f-new': 'remote-only',
      'project.json': 'local-only',
    });
  });

  it('reports a tracked document whose cloud file is gone', () => {
    const syncState = state({ files: { 'doc-1': { fileId: 'f-1', remoteModified: '2024-01-01T11:00:00.000Z', localModified: '2024-01-01T10:00:00.000Z' } } });
    const rows = compareDocuments(makeProject(), { remoteDocs: [], remoteProjectFile: null }, syncState);
    expect(rows[0]).toMatchObject({ key: 'doc-1', state: 'remote-deleted' });
  });

  it('compares project.json with the last local change', () => {
    const project = makeProject({ history: [{ id: 'h', timestamp: '2024-03-02T00:00:00.000Z' }] as never });
    const snapshot = { remoteDocs: [], remoteProjectFile: makeFile({ id: 'pf', name: 'project.json', modifiedTime: '2024-03-03T00:00:00.000Z' }) };
    const both = compareDocuments(project, snapshot, state({ projectRemoteModified: '2024-03-01T00:00:00.000Z', projectLocalModified: '2024-03-01T00:00:00.000Z' }));
    expect(both.at(-1)).toMatchObject({ key: 'project.json', state: 'both-changed' });

    const settled = compareDocuments(project, snapshot, state({ projectRemoteModified: '2024-03-03T00:00:00.000Z', projectLocalModified: '2024-03-02T00:00:00.000Z' }));
    expect(settled.at(-1)).toMatchObject({ key: 'project.json', state: 'in-sync' });
  });
});
