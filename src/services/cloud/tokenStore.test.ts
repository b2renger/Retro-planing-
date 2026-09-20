import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTokens, getValidAccessToken, loadTokens, parseStoredTokens, saveTokens, tokenStorageKey } from './tokenStore';
import { CloudError, type OAuthTokens } from './types';
import { fetchCall, jsonResponse } from './testFixtures';

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  });
  return store;
}

let store: Map<string, string>;

beforeEach(() => {
  store = stubLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fresh: OAuthTokens = { accessToken: 'live', refreshToken: 'rt', expiresAt: Date.now() + 3600_000 };

describe('tokenStore (localStorage branch)', () => {
  it('round-trips tokens under the provider key', async () => {
    await saveTokens('google', fresh);
    expect(store.has(tokenStorageKey('google'))).toBe(true);
    expect(store.get('rps_cloud_tokens_google')).toContain('"accessToken":"live"');
    await expect(loadTokens('google')).resolves.toEqual(fresh);
    await expect(loadTokens('onedrive')).resolves.toBeNull();
    await clearTokens('google');
    await expect(loadTokens('google')).resolves.toBeNull();
  });

  it('treats corrupt blobs as absent', () => {
    expect(parseStoredTokens('not json')).toBeNull();
    expect(parseStoredTokens('{"accessToken":1}')).toBeNull();
    expect(parseStoredTokens(null)).toBeNull();
  });
});

describe('getValidAccessToken', () => {
  it('returns the stored token while valid', async () => {
    await saveTokens('onedrive', fresh);
    await expect(getValidAccessToken('onedrive', { clientId: 'c' })).resolves.toBe('live');
  });

  it('throws an auth error when nothing is stored', async () => {
    const err = await getValidAccessToken('google', { clientId: 'c' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudError);
    expect((err as CloudError).kind).toBe('auth');
    expect((err as CloudError).message).toMatch(/reconnect/);
  });

  it('throws an auth error when expired without a refresh token', async () => {
    await saveTokens('google', { accessToken: 'old', expiresAt: Date.now() - 1 });
    await expect(getValidAccessToken('google', { clientId: 'c' })).rejects.toMatchObject({ kind: 'auth' });
  });

  it('refreshes an expired token and persists the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'renewed', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    await saveTokens('google', { accessToken: 'old', refreshToken: 'rt', expiresAt: Date.now() - 1 });
    await expect(getValidAccessToken('google', { clientId: 'cid', clientSecret: 'sec' })).resolves.toBe('renewed');
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.body).toBe('grant_type=refresh_token&client_id=cid&client_secret=sec&refresh_token=rt');
    const stored = await loadTokens('google');
    expect(stored?.accessToken).toBe('renewed');
    expect(stored?.refreshToken).toBe('rt');
  });

  it('never sends a secret for Microsoft refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'renewed', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    await saveTokens('onedrive', { accessToken: 'old', refreshToken: 'rt', expiresAt: 0 });
    await getValidAccessToken('onedrive', { clientId: 'cid', clientSecret: 'sec' });
    expect(fetchCall(fetchMock).init.body).not.toContain('client_secret');
  });

  it('wraps a failed refresh as a reconnect-required auth error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, 400)));
    await saveTokens('google', { accessToken: 'old', refreshToken: 'rt', expiresAt: 0 });
    await expect(getValidAccessToken('google', { clientId: 'cid' })).rejects.toThrow(/reconnect required/);
  });
});
