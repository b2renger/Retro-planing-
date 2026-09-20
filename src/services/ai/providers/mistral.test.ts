import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mistralAdapter } from './mistral';
import { JSON_MODE_HINT } from './shared';
import { cfg, jsonResponse, mockFetch, requestAt, restoreMocks, type FetchMock } from '../test-helpers';

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(restoreMocks);

describe('mistralAdapter', () => {
  it('uses the Mistral endpoint, Bearer auth, max_tokens and json response_format', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '{}' } }] }));
    const res = await mistralAdapter.chat(cfg('mistral', { apiKey: 'mk', model: 'mistral-medium-latest' }), [{ role: 'user', content: 'hi' }], { json: true, maxTokens: 9 });
    const req = requestAt(fetchMock);
    expect(req.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(req.headers['authorization']).toBe('Bearer mk');
    expect(req.body).toEqual({
      model: 'mistral-medium-latest',
      messages: [{ role: 'system', content: JSON_MODE_HINT }, { role: 'user', content: 'hi' }],
      max_tokens: 9,
      response_format: { type: 'json_object' },
    });
    expect(res.providerId).toBe('mistral');
  });

  it('lists models from /models', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'mistral-small-latest' }, { id: 'codestral-latest' }] }));
    const models = await mistralAdapter.listModels(cfg('mistral'));
    expect(requestAt(fetchMock).url).toBe('https://api.mistral.ai/v1/models');
    expect(models.map((m) => m.id)).toEqual(['codestral-latest', 'mistral-small-latest']);
  });
});
