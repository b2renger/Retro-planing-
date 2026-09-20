import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { llmOnLanAdapter, normalizeLlmOnLanEndpoint, normalizeOpenAiBaseUrl, openaiCompatibleAdapter } from './openaiCompatible';
import { JSON_MODE_HINT } from './shared';
import { cfg, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from '../test-helpers';

describe('normalizeOpenAiBaseUrl', () => {
  it.each([
    ['http://localhost:11434', 'http://localhost:11434/v1'],
    ['http://localhost:11434/', 'http://localhost:11434/v1'],
    ['http://localhost:1234/v1', 'http://localhost:1234/v1'],
    ['http://localhost:1234/v1/', 'http://localhost:1234/v1'],
    ['localhost:1234', 'http://localhost:1234/v1'],
    ['192.168.1.20', 'http://192.168.1.20/v1'],
    ['192.168.1.20:4000/v1', 'http://192.168.1.20:4000/v1'],
    ['https://host.example/api/v1', 'https://host.example/api/v1'],
    ['https://api.x.com/openai/v1', 'https://api.x.com/openai/v1'],
    ['http://host:4000', 'http://host:4000/v1'],
    ['http://host:4000/v1/', 'http://host:4000/v1'],
    ['https://host.example/v1beta', 'https://host.example/v1beta/v1'],
    ['  http://x:1/  ', 'http://x:1/v1'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeOpenAiBaseUrl(input)).toBe(expected);
  });
});

describe('normalizeLlmOnLanEndpoint', () => {
  it.each([
    ['192.168.1.20', 'http://192.168.1.20:4000/v1'],
    ['192.168.1.20:5000', 'http://192.168.1.20:5000/v1'],
    ['http://192.168.1.20:4000/v1', 'http://192.168.1.20:4000/v1'],
    ['farm.local/', 'http://farm.local:4000/v1'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLlmOnLanEndpoint(input)).toBe(expected);
  });
});

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(restoreMocks);

describe('openaiCompatibleAdapter.chat', () => {
  it('normalises the base URL, omits auth when keyless, sends max_tokens, and asks for JSON in the prompt instead of response_format', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '{"ok":1}' } }] }));
    const res = await openaiCompatibleAdapter.chat(
      cfg('openai-compatible', { apiKey: undefined, baseUrl: 'localhost:11434', model: 'llama3' }),
      [{ role: 'user', content: 'hi' }],
      { json: true, maxTokens: 12 }
    );
    const req = requestAt(fetchMock);
    expect(req.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(req.headers['authorization']).toBeUndefined();
    expect(req.body).toEqual({ model: 'llama3', messages: [{ role: 'system', content: JSON_MODE_HINT }, { role: 'user', content: 'hi' }], max_tokens: 12 });
    expect(res.providerId).toBe('openai-compatible');
    expect(res.text).toBe('{"ok":1}');
  });

  it('sends Bearer only when a key is present', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    await openaiCompatibleAdapter.chat(cfg('openai-compatible', { apiKey: 'lm', baseUrl: 'http://localhost:1234/v1' }), [{ role: 'user', content: 'hi' }]);
    expect(requestAt(fetchMock).headers['authorization']).toBe('Bearer lm');
  });

  it('throws not-configured without a base URL', async () => {
    await expect(openaiCompatibleAdapter.chat(cfg('openai-compatible', { baseUrl: '' }), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists models from {baseUrl}/models', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'qwen' }, { id: 'llama3' }] }));
    const models = await openaiCompatibleAdapter.listModels(cfg('openai-compatible', { apiKey: '', baseUrl: 'http://localhost:11434' }));
    const req = requestAt(fetchMock);
    expect(req.url).toBe('http://localhost:11434/v1/models');
    expect(req.headers['authorization']).toBeUndefined();
    expect(models.map((m) => m.id)).toEqual(['llama3', 'qwen']);
  });
});

describe('llmOnLanAdapter', () => {
  it('reports providerId llmonlan and uses the farm base URL with an optional master key', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    const res = await llmOnLanAdapter.chat(cfg('llmonlan', { apiKey: 'master', baseUrl: 'http://192.168.1.20:4000/v1', model: 'farm-model' }), [{ role: 'user', content: 'hi' }]);
    const req = requestAt(fetchMock);
    expect(req.url).toBe('http://192.168.1.20:4000/v1/chat/completions');
    expect(req.headers['authorization']).toBe('Bearer master');
    expect(res.providerId).toBe('llmonlan');
  });
});
