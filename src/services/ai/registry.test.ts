import { describe, expect, it } from 'vitest';
import { getAdapter, PROVIDER_CATALOG } from './registry';
import type { AiProviderId } from './types';

describe('PROVIDER_CATALOG', () => {
  it('has an adapter and a docs link for every provider family', () => {
    for (const id of Object.keys(PROVIDER_CATALOG) as AiProviderId[]) {
      expect(getAdapter(id)).toBeDefined();
      expect(PROVIDER_CATALOG[id].docsUrl).toMatch(/^https:\/\//);
    }
  });

  it('points LlmOnLan farms at the project repository and cloud providers at their real endpoints', () => {
    expect(PROVIDER_CATALOG.llmonlan.docsUrl).toBe('https://github.com/b2renger/LlmOnLan');
    expect(PROVIDER_CATALOG.llmonlan).toMatchObject({ requiresKey: false, requiresBaseUrl: true });
    expect(PROVIDER_CATALOG.gemini.defaultBaseUrl).toBe('https://generativelanguage.googleapis.com');
    expect(PROVIDER_CATALOG.openai.defaultBaseUrl).toBe('https://api.openai.com/v1');
    expect(PROVIDER_CATALOG.anthropic.defaultBaseUrl).toBe('https://api.anthropic.com');
    expect(PROVIDER_CATALOG.mistral.defaultBaseUrl).toBe('https://api.mistral.ai/v1');
  });
});
