import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { geminiAdapter } from './gemini';
import { cfg, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from '../test-helpers';
import { AiError } from '../types';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(restoreMocks);

describe('geminiAdapter.chat', () => {
  it('posts to generateContent with x-goog-api-key and maps roles', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'Hel' }, { text: 'lo' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
      })
    );
    const res = await geminiAdapter.chat(
      cfg('gemini', { apiKey: 'KEY', model: 'gemini-3.8-flash' }),
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'yo' },
        { role: 'user', content: 'again' },
      ],
      { json: true, temperature: 0.2, maxTokens: 50 }
    );
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(req.method).toBe('POST');
    expect(req.headers['x-goog-api-key']).toBe('KEY');
    expect(req.url).not.toContain('key=');
    expect(req.body).toEqual({
      systemInstruction: { parts: [{ text: 'sys' }] },
      contents: [
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ text: 'yo' }] },
        { role: 'user', parts: [{ text: 'again' }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 50, responseMimeType: 'application/json' },
    });
    expect(res.text).toBe('Hello');
    expect(res.providerId).toBe('gemini');
    expect(res.model).toBe('gemini-3.8-flash');
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 2 });
  });

  it('omits systemInstruction, generationConfig and responseMimeType when not needed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
    await geminiAdapter.chat(cfg('gemini'), [{ role: 'user', content: 'hi' }]);
    const body = requestAt(fetchMock).body as Record<string, unknown>;
    expect(body.systemInstruction).toBeUndefined();
    expect(body.generationConfig).toBeUndefined();
  });

  it('throws not-configured without a key', async () => {
    await expect(geminiAdapter.chat(cfg('gemini', { apiKey: '' }), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a blocked prompt as invalid-request (not retried by chatJson) with the block reason', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }));
    await expect(geminiAdapter.chat(cfg('gemini'), [{ role: 'user', content: 'x' }])).rejects.toSatisfy(
      (e: unknown) => e instanceof AiError && e.kind === 'invalid-request' && e.message.includes('SAFETY')
    );
  });

  it('reports a candidate stopped by policy or by the token limit with its finishReason', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ finishReason: 'SAFETY', safetyRatings: [] }] }));
    await expect(geminiAdapter.chat(cfg('gemini'), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'invalid-request', message: 'gemini: no text returned (finishReason: SAFETY)' });

    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ content: { role: 'model' }, finishReason: 'MAX_TOKENS' }] }));
    await expect(geminiAdapter.chat(cfg('gemini'), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'parse', message: 'gemini: no text returned (finishReason: MAX_TOKENS)' });

    fetchMock.mockResolvedValue(jsonResponse({ candidates: [] }));
    await expect(geminiAdapter.chat(cfg('gemini'), [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'parse' });
  });

  it('ignores thought parts and reports the served modelVersion', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'answer' }] } }], modelVersion: 'gemini-3.8-flash-001' }));
    const res = await geminiAdapter.chat(cfg('gemini', { model: 'gemini-3.8-flash' }), [{ role: 'user', content: 'x' }]);
    expect(res.text).toBe('answer');
    expect(res.model).toBe('gemini-3.8-flash-001');
  });
});

describe('geminiAdapter.listModels', () => {
  it('filters generateContent models and strips the models/ prefix', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [
          { name: 'models/gemini-3.8-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-3.1-pro-preview', supportedGenerationMethods: ['generateContent', 'countTokens'] },
        ],
      })
    );
    const models = await geminiAdapter.listModels(cfg('gemini', { apiKey: 'K' }));
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200');
    expect(req.method).toBe('GET');
    expect(req.headers['x-goog-api-key']).toBe('K');
    expect(models).toEqual([{ id: 'gemini-3.8-flash', label: 'Flash' }, { id: 'gemini-3.1-pro-preview', label: undefined }]);
  });
});
