import { describe, expect, it } from 'vitest';
import { HttpError } from '../http/httpClient';
import { kindFromStatus, toAiError } from './errors';
import { AiError } from './types';

describe('kindFromStatus', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [400, 'invalid-request'],
    [404, 'invalid-request'],
    [422, 'invalid-request'],
    [500, 'unknown'],
    [503, 'unknown'],
  ] as const)('%s → %s', (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe('toAiError', () => {
  it('passes AiErrors through and keeps the provider message and status from HttpErrors', () => {
    const own = new AiError('mine', 'parse', 'gemini');
    expect(toAiError(own, 'openai')).toBe(own);
    const http = toAiError(new HttpError('openai: HTTP 503 Service Unavailable — overloaded', 503, 'u', '{}'), 'openai');
    expect(http).toMatchObject({ kind: 'unknown', status: 503, providerId: 'openai' });
    expect(http.message).toContain('overloaded');
  });

  it('maps aborts, fetch TypeErrors and bridge-worded connection failures to network', () => {
    expect(toAiError(Object.assign(new Error('x'), { name: 'AbortError' }), 'mistral').kind).toBe('network');
    expect(toAiError(new TypeError('Failed to fetch'), 'mistral').kind).toBe('network');
    expect(toAiError(new Error('Network error for http://10.0.0.5:4000/v1/models: fetch failed (ECONNREFUSED)'), 'llmonlan').kind).toBe('network');
    expect(toAiError(new Error('Request to http://10.0.0.5:4000/v1/models timed out'), 'llmonlan').kind).toBe('network');
    expect(toAiError(new Error('getaddrinfo ENOTFOUND farm.local'), 'llmonlan').kind).toBe('network');
  });

  it('leaves other errors as unknown with their message', () => {
    expect(toAiError(new Error('boom'), 'anthropic')).toMatchObject({ kind: 'unknown', message: 'boom', providerId: 'anthropic' });
    expect(toAiError('plain string', 'anthropic').message).toBe('plain string');
  });
});
