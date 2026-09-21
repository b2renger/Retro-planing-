/**
 * The weekly expiry, end to end through `runProjectSync`.
 *
 * b2renger chose the full `drive` scope, which Google classifies as restricted, so the OAuth
 * project must stay in Testing mode and every refresh token dies after seven days. The token
 * endpoint answers `invalid_grant`, and what must come out the other end is a calm, distinct
 * `expired` status with a one-click cure — never a thrown error and never a "sync failed".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runProjectSync, type SyncDeps } from './useCloudSync';
import { saveTokens } from '../services/cloud/tokenStore';
import { initialSyncState } from '../services/cloud/syncEngine';
import { makeProject, jsonResponse } from '../services/cloud/testFixtures';
import type { CloudStatus, Notification, Project } from '../types';

function stubLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

/** A project already linked to a Drive folder, so a sync actually runs. */
function linkedProject(): Project {
  const syncState = initialSyncState('google', { rootFolderId: 'root-id', projectFolderId: 'proj-id', docsFolderId: 'docs-id', exportsFolderId: 'exports-id' });
  return makeProject({
    cloud: { providerId: 'google', folderId: 'proj-id', docsFolderId: 'docs-id', syncState, lastSyncAt: '2024-01-01T10:00:00.000Z' },
  });
}

function collectingDeps(): { deps: SyncDeps; statuses: CloudStatus[]; notes: Array<Omit<Notification, 'id' | 'timestamp' | 'read'>> } {
  const statuses: CloudStatus[] = [];
  const notes: Array<Omit<Notification, 'id' | 'timestamp' | 'read'>> = [];
  return {
    statuses,
    notes,
    deps: {
      cloudSettings: { google: { clientId: 'cid', clientSecret: 'sec' }, onedrive: { clientId: '' } },
      applyCloudPatch: () => undefined,
      setCloudLink: () => undefined,
      setCloudStatus: (s) => void statuses.push(s),
      addNotification: (n) => void notes.push(n),
    },
  };
}

beforeEach(async () => {
  stubLocalStorage();
  // An access token that has already expired, with a refresh token the provider will reject.
  await saveTokens('google', { accessToken: 'stale', refreshToken: 'rt', expiresAt: 0 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runProjectSync — an expired sign-in', () => {
  it('resolves instead of throwing', async () => {
    const { deps } = collectingDeps();
    await expect(runProjectSync(linkedProject(), deps)).resolves.toBeTruthy();
  });

  it('reports the reconnect state, not an error', async () => {
    const { deps, statuses } = collectingDeps();
    const outcome = await runProjectSync(linkedProject(), deps);
    expect(outcome.expired).toBe(true);
    expect(outcome.needsReconnect).toBe(true);
    expect(statuses.at(-1)?.state).toBe('expired');
    expect(statuses.map((s) => s.state)).not.toContain('error');
  });

  it('names the provider to reconnect, so the chip knows which flow to run', async () => {
    const { deps, statuses } = collectingDeps();
    await runProjectSync(linkedProject(), deps);
    expect(statuses.at(-1)?.providerId).toBe('google');
  });

  it('notifies about the sign-in, never about a sync failure', async () => {
    const { deps, notes } = collectingDeps();
    await runProjectSync(linkedProject(), deps);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toMatch(/sign-in expired/i);
    expect(notes[0].title).not.toMatch(/failed/i);
    expect(notes[0].message).toMatch(/Nothing was lost/i);
  });
});

describe('runProjectSync — a genuine failure still reports as an error', () => {
  it('keeps `error` for a server fault rather than claiming the sign-in expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Backend error' } }, 500)));
    await saveTokens('google', { accessToken: 'live', refreshToken: 'rt', expiresAt: Date.now() + 3600_000 });
    const { deps, statuses } = collectingDeps();
    const outcome = await runProjectSync(linkedProject(), deps);
    expect(outcome.expired).toBeFalsy();
    expect(statuses.at(-1)?.state).toBe('error');
  });
});
