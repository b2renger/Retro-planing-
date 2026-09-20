import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anthropicAdapter } from './anthropic';
import { cfg, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from '../test-helpers';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(restoreMocks);

describe('anthropicAdapter.chat', () => {
  it('posts to /v1/messages with the three required headers and a system field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ model: 'claude-sonnet-5', content: [{ type: 'text', text: 'Hel' }, { type: 'text', text: 'lo' }], usage: { input_tokens: 7, output_tokens: 2 } })
    );
    const res = await anthropicAdapter.chat(
      cfg('anthropic', { apiKey: 'sk-ant', model: 'claude-sonnet-5' }),
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'yo' },
        { role: 'user', content: 'more' },
      ],
      { maxTokens: 123, temperature: 0.1 }
    );
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.method).toBe('POST');
    expect(req.headers['x-api-key']).toBe('sk-ant');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(req.headers['authorization']).toBeUndefined();
    expect(req.body).toEqual({
      model: 'claude-sonnet-5',
      max_tokens: 123,
      system: 'sys',
      temperature: 0.1,
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'yo' },
        { role: 'user', content: 'more' },
      ],
    });
    expect(res.text).toBe('Hello');
    expect(res.usage).toEqual({ inputTokens: 7, outputTokens: 2 });
    expect(res.providerId).toBe('anthropic');
  });

  it('defaults max_tokens to 4096 and appends the JSON instruction to the system prompt in json mode', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'text', text: '{}' }] }));
    await anthropicAdapter.chat(cfg('anthropic'), [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }], { json: true });
    const body = requestAt(fetchMock).body as Record<string, unknown>;
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe('sys\n\nRespond with a single JSON object only, no markdown fences.');
  });

  it('adds a system field in json mode even without a system message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'text', text: '{}' }] }));
    await anthropicAdapter.chat(cfg('anthropic'), [{ role: 'user', content: 'hi' }], { json: true });
    expect((requestAt(fetchMock).body as Record<string, unknown>).system).toBe('Respond with a single JSON object only, no markdown fences.');
  });

  it('merges consecutive same-role turns, drops empty ones and trims a trailing assistant prefill', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'text', text: 'ok' }] }));
    await anthropicAdapter.chat(cfg('anthropic'), [
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: '   ' },
      { role: 'assistant', content: 'c' },
      { role: 'system', content: 'late system' },
      { role: 'user', content: 'd' },
      { role: 'assistant', content: '{ \n' },
    ]);
    const body = requestAt(fetchMock).body as { system: string; messages: unknown[] };
    expect(body.messages).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
      { role: 'user', content: 'd' },
      { role: 'assistant', content: '{' },
    ]);
    expect(body.system).toBe('late system');
  });

  it('rejects a conversation that does not start with a user turn before any network call', async () => {
    await expect(anthropicAdapter.chat(cfg('anthropic'), [{ role: 'assistant', content: 'x' }, { role: 'user', content: 'y' }])).rejects.toMatchObject({ kind: 'invalid-request' });
    await expect(anthropicAdapter.chat(cfg('anthropic'), [{ role: 'system', content: 'only' }])).rejects.toMatchObject({ kind: 'invalid-request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps only text blocks and surfaces stop_reason when nothing textual came back', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'thinking', thinking: 'hmm', text: 'nope' }, { type: 'text', text: 'yes' }], stop_reason: 'end_turn' }));
    expect((await anthropicAdapter.chat(cfg('anthropic'), [{ role: 'user', content: 'hi' }])).text).toBe('yes');

    fetchMock.mockResolvedValue(jsonResponse({ content: [], stop_reason: 'refusal' }));
    await expect(anthropicAdapter.chat(cfg('anthropic'), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'invalid-request', message: 'anthropic: no text returned (stop_reason: refusal)' });

    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'thinking', thinking: 'x' }], stop_reason: 'max_tokens' }));
    await expect(anthropicAdapter.chat(cfg('anthropic'), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'parse', message: expect.stringContaining('max_tokens') });

    fetchMock.mockResolvedValue(jsonResponse({ content: [], stop_reason: 'end_turn' }));
    expect((await anthropicAdapter.chat(cfg('anthropic'), [{ role: 'user', content: 'hi' }])).text).toBe('');
  });

  it('throws parse when content[] is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ type: 'message' }));
    await expect(anthropicAdapter.chat(cfg('anthropic'), [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({ kind: 'parse' });
  });
});

describe('anthropicAdapter.listModels', () => {
  it('reads data[].id with the same headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' }, { id: 'claude-opus-5' }] }));
    const models = await anthropicAdapter.listModels(cfg('anthropic', { apiKey: 'sk-ant' }));
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://api.anthropic.com/v1/models?limit=100');
    expect(req.method).toBe('GET');
    expect(req.headers['x-api-key']).toBe('sk-ant');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
    expect(models).toEqual([{ id: 'claude-sonnet-5', label: 'Claude Sonnet 5' }, { id: 'claude-opus-5', label: undefined }]);
  });
});
