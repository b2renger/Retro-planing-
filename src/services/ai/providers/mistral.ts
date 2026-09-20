import type { AiAdapter, ChatOptions } from '../types';
import { openAiChat, openAiListModels, requireApiKey } from './shared';

export const MISTRAL_DEFAULT_BASE_URL = 'https://api.mistral.ai/v1';
export const MISTRAL_DEFAULT_MODEL = 'mistral-medium-latest';
export const MISTRAL_FALLBACK_MODELS = ['mistral-medium-latest', 'mistral-large-latest', 'mistral-small-latest'];

function baseUrl(raw?: string): string {
  return (raw?.trim() || MISTRAL_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Mistral "La Plateforme": OpenAI wire format with `response_format` JSON mode. */
export const mistralAdapter: AiAdapter = {
  async chat(cfg, messages, opts: ChatOptions = {}) {
    return openAiChat(cfg, messages, opts, {
      providerId: 'mistral',
      baseUrl: baseUrl(cfg.baseUrl),
      apiKey: requireApiKey(cfg, 'mistral'),
      supportsResponseFormat: true,
      maxTokensField: 'max_tokens',
    });
  },
  async listModels(cfg) {
    return openAiListModels({ providerId: 'mistral', baseUrl: baseUrl(cfg.baseUrl), apiKey: requireApiKey(cfg, 'mistral') }, 15_000);
  },
};
