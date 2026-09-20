import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openaiAdapter } from './openai';
import { JSON_MODE_HINT } from './shared';
import { cfg, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from '../test-helpers';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(restoreMocks);

describe('openaiAdapter.chat', () => {
  it('posts to /chat/completions with Bearer auth and json response_format', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ model: 'gpt-5-mini-2026', choices: [{ message: { role: 'assistant', content: '{"a":1}' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } })
    );
    const res = await openaiAdapter.chat(
      cfg('openai', { apiKey: 'sk-1', model: 'gpt-5-mini' }),
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'Give me JSON' },
      ],
      { json: true, maxTokens: 20 }
    );
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(req.method).toBe('POST');
    expect(req.headers['authorization']).toBe('Bearer sk-1');
    expect(req.headers['content-type']).toBe('application/json');
    expect(req.body).toEqual({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'Give me JSON' },
      ],
      max_completion_tokens: 20,
      response_format: { type: 'json_object' },
    });
    expect(res.text).toBe('{"a":1}');
    expect(res.model).toBe('gpt-5-mini-2026');
    expect(res.providerId).toBe('openai');
    expect(res.usage).toEqual({ inputTokens: 5, outputTokens: 3 });
  });

  it('does not send response_format or temperature unless requested', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    await openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'hi' }]);
    const body = requestAt(fetchMock).body as Record<string, unknown>;
    expect(body.response_format).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });

  it('honours a custom baseUrl with a trailing slash', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    await openaiAdapter.chat(cfg('openai', { baseUrl: 'https://proxy.example/v1/' }), [{ role: 'user', content: 'hi' }]);
    expect(requestAt(fetchMock).url).toBe('https://proxy.example/v1/chat/completions');
  });

  it('adds the JSON hint to the system message in json mode when nothing mentions JSON (OpenAI 400s otherwise)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ choices: [{ message: { content: '{}' } }] }));
    await openaiAdapter.chat(cfg('openai'), [{ role: 'system', content: 'sys' }, { role: 'user', content: 'plan it' }], { json: true });
    const withSystem = requestAt(fetchMock).body as { messages: { role: string; content: string }[] };
    expect(withSystem.messages).toEqual([{ role: 'system', content: `sys\n\n${JSON_MODE_HINT}` }, { role: 'user', content: 'plan it' }]);

    await openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'plan it' }], { json: true });
    const noSystem = requestAt(fetchMock).body as { messages: { role: string; content: string }[] };
    expect(noSystem.messages).toEqual([{ role: 'system', content: JSON_MODE_HINT }, { role: 'user', content: 'plan it' }]);

    await openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'plan it as json' }], { json: true });
    expect((requestAt(fetchMock).body as { messages: unknown[] }).messages).toEqual([{ role: 'user', content: 'plan it as json' }]);

    await openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'plan it' }]);
    expect((requestAt(fetchMock).body as { messages: unknown[] }).messages).toEqual([{ role: 'user', content: 'plan it' }]);
  });

  it('reports a refusal or an empty finish_reason instead of a bare missing-content error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null, refusal: 'I cannot do that.' } }] }));
    await expect(openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'parse', message: 'openai: model refused: I cannot do that.' });

    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{}] } }] }));
    await expect(openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'parse', message: expect.stringContaining('finish_reason: tool_calls') });
  });

  it('throws parse when choices are missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));
    await expect(openaiAdapter.chat(cfg('openai'), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'parse' });
  });
});

describe('openaiAdapter.listModels', () => {
  it('reads data[].id sorted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'gpt-5.2' }, { id: 'gpt-5-mini' }, { id: 'dall-e-3' }] }));
    const models = await openaiAdapter.listModels(cfg('openai', { apiKey: 'sk-2' }));
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://api.openai.com/v1/models');
    expect(req.method).toBe('GET');
    expect(req.headers['authorization']).toBe('Bearer sk-2');
    expect(models.map((m) => m.id)).toEqual(['dall-e-3', 'gpt-5-mini', 'gpt-5.2']);
  });
});
