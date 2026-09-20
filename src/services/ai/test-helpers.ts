import { vi, type Mock } from 'vitest';
import type { AiProviderConfig, AiProviderId } from './types';

/** Build a `Response` carrying a JSON body. */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

export type FetchMock = Mock<(url: string, init?: RequestInit) => Promise<Response>>;

/** Install a `vi.fn()` as `globalThis.fetch` (via `vi.stubGlobal`, so `restoreMocks` puts the real one back) and return it. */
export function mockFetch(): FetchMock {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Restore `globalThis.fetch` (and any other stubbed global) and every spy; call from `afterEach`. */
export function restoreMocks(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Decode the n-th (default last) call made to a fetch mock. */
export function requestAt(fetchMock: FetchMock, index = -1): CapturedRequest {
  const calls = fetchMock.mock.calls;
  const [url, init] = calls[index < 0 ? calls.length + index : index];
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries((init?.headers as Record<string, string>) || {})) headers[k.toLowerCase()] = v;
  const raw = init?.body;
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  return { url, method: init?.method || 'GET', headers, body };
}

/** Minimal provider config for tests. */
export function cfg(providerId: AiProviderId, overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return { id: `t-${providerId}`, providerId, label: providerId, apiKey: 'test-key', model: 'test-model', enabled: true, ...overrides };
}

/** A rejected fetch that looks like a browser network failure. */
export function networkFailure(): Promise<Response> {
  return Promise.reject(new TypeError('Failed to fetch'));
}

/** A fetch mock that rejects with AbortError when the request's signal fires (for timeout tests). */
export function hangUntilAbort(): (url: string, init?: RequestInit) => Promise<Response> {
  return (_url, init) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));
    });
}
