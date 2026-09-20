import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chat, chatJson, listModels, testConnection } from './client';
import { JSON_MODE_HINT } from './providers/shared';
import { cfg, jsonResponse, mockFetch, networkFailure, requestAt, restoreMocks, type FetchMock } from './test-helpers';
import { AiError } from './types';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(restoreMocks);

const openai = cfg('openai', { apiKey: 'sk', model: 'gpt-5-mini' });
const reply = (content: string) => jsonResponse({ model: 'gpt-5-mini', choices: [{ message: { content } }] });

async function expectAiError(p: Promise<unknown>, kind: AiError['kind'], status?: number): Promise<AiError> {
  let caught: unknown;
  try {
    await p;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(AiError);
  const err = caught as AiError;
  expect(err.kind).toBe(kind);
  if (status !== undefined) expect(err.status).toBe(status);
  return err;
}

describe('chat error mapping', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [400, 'invalid-request'],
    [404, 'invalid-request'],
    [422, 'invalid-request'],
    [500, 'unknown'],
  ] as const)('HTTP %s → %s', async (status, kind) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'nope' } }, status));
    const err = await expectAiError(chat(openai, [{ role: 'user', content: 'x' }]), kind, status);
    expect(err.providerId).toBe('openai');
    expect(err.message).toContain('nope');
  });

  it('maps a fetch TypeError to network', async () => {
    fetchMock.mockImplementation(networkFailure);
    await expectAiError(chat(openai, [{ role: 'user', content: 'x' }]), 'network');
  });

  it('maps the Electron bridge wording for connection failures and timeouts to network', async () => {
    fetchMock.mockRejectedValue(new Error('Network error for http://192.168.1.20:4000/v1/chat/completions: fetch failed (ECONNREFUSED)'));
    const refused = await expectAiError(chat(openai, [{ role: 'user', content: 'x' }]), 'network');
    expect(refused.message).toContain('ECONNREFUSED');
    fetchMock.mockRejectedValue(new Error('Request to http://10.0.0.5:4000/v1/chat/completions timed out'));
    await expectAiError(chat(openai, [{ role: 'user', content: 'x' }]), 'network');
    fetchMock.mockRejectedValue(new Error('something else broke'));
    await expectAiError(chat(openai, [{ role: 'user', content: 'x' }]), 'unknown');
  });

  it('maps an abort to network', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expectAiError(chat(openai, [{ role: 'user', content: 'x' }]), 'network');
  });

  it('rejects a provider that requires a key before any network call', async () => {
    await expectAiError(chat(cfg('anthropic', { apiKey: '' }), [{ role: 'user', content: 'x' }]), 'not-configured');
    await expectAiError(chat(cfg('llmonlan', { baseUrl: '' }), [{ role: 'user', content: 'x' }]), 'not-configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies a default timeout that adapters forward to fetch', async () => {
    fetchMock.mockResolvedValue(reply('ok'));
    await chat(openai, [{ role: 'user', content: 'x' }]);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('chatJson', () => {
  it('parses on the first try and sets json mode', async () => {
    fetchMock.mockResolvedValue(reply('```json\n{"a":1}\n```'));
    const out = await chatJson<{ a: number }>(openai, [{ role: 'user', content: 'x' }]);
    expect(out.data).toEqual({ a: 1 });
    expect(out.retried).toBe(false);
    const body = requestAt(fetchMock).body as { response_format: unknown; messages: { role: string; content: string }[] };
    expect(body.response_format).toEqual({ type: 'json_object' });
    // 'x' never mentions JSON, so the OpenAI-mandated hint is added.
    expect(body.messages).toEqual([{ role: 'system', content: JSON_MODE_HINT }, { role: 'user', content: 'x' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with a nudge when the first reply is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(reply('Sorry, here you go')).mockResolvedValueOnce(reply('{"b":2}'));
    const out = await chatJson<{ b: number }>(openai, [{ role: 'user', content: 'x' }]);
    expect(out.data).toEqual({ b: 2 });
    expect(out.retried).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const msgs = (requestAt(fetchMock, 1).body as { messages: { role: string; content: string }[] }).messages;
    // The nudge itself mentions JSON, so no extra hint is inserted on the retry.
    expect(msgs).toEqual([
      { role: 'user', content: 'x' },
      { role: 'assistant', content: 'Sorry, here you go' },
      { role: 'user', content: 'Return only valid JSON.' },
    ]);
  });

  it('gives up with a parse error after the second failure', async () => {
    fetchMock.mockImplementation(async () => reply('still prose'));
    await expectAiError(chatJson(openai, [{ role: 'user', content: 'x' }]), 'parse');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-parse errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    await expectAiError(chatJson(openai, [{ role: 'user', content: 'x' }]), 'auth');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('listModels', () => {
  it('returns live models', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'gpt-5-mini' }] }));
    const out = await listModels(openai);
    expect(out).toEqual({ models: [{ id: 'gpt-5-mini' }], fromFallback: false });
  });

  it('falls back to the catalog list on error and keeps the error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    const out = await listModels(openai);
    expect(out.fromFallback).toBe(true);
    expect(out.models.map((m) => m.id)).toEqual(['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano']);
    expect(out.error?.kind).toBe('auth');
  });

  it('falls back on network failure and on not-configured', async () => {
    fetchMock.mockImplementation(networkFailure);
    expect((await listModels(cfg('gemini'))).models.map((m) => m.id)).toEqual(['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite']);
    const out = await listModels(cfg('anthropic', { apiKey: '' }));
    expect(out.fromFallback).toBe(true);
    expect(out.error?.kind).toBe('not-configured');
  });
});

describe('testConnection', () => {
  it('returns ok with the sample reply and a small max token budget that survives reasoning models', async () => {
    fetchMock.mockResolvedValue(reply(' OK '));
    const out = await testConnection(openai);
    expect(out.ok).toBe(true);
    expect(out.sampleReply).toBe('OK');
    expect(out.model).toBe('gpt-5-mini');
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    const body = requestAt(fetchMock).body as Record<string, unknown>;
    expect(body.max_completion_tokens).toBe(256);
    expect((body.messages as { content: string }[])[0].content).toBe('Reply with the single word OK');
  });

  it('never throws: reports auth failures and network failures as ok:false', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'bad key' } }, 401));
    const auth = await testConnection(openai);
    expect(auth).toMatchObject({ ok: false, errorKind: 'auth', model: 'gpt-5-mini' });
    expect(auth.message).toContain('bad key');

    fetchMock.mockImplementation(networkFailure);
    expect((await testConnection(openai)).errorKind).toBe('network');
    expect((await testConnection(cfg('openai', { apiKey: '' }))).errorKind).toBe('not-configured');
  });
});
