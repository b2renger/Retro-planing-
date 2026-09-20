import type { AiAdapter, ChatOptions } from '../types';
import { openAiChat, openAiListModels, requireApiKey } from './shared';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';
export const OPENAI_FALLBACK_MODELS = ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano'];

function baseUrl(raw?: string): string {
  return (raw?.trim() || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** OpenAI Chat Completions (`Authorization: Bearer`, `response_format` JSON mode, `max_completion_tokens`). */
export const openaiAdapter: AiAdapter = {
  async chat(cfg, messages, opts: ChatOptions = {}) {
    return openAiChat(cfg, messages, opts, {
      providerId: 'openai',
      baseUrl: baseUrl(cfg.baseUrl),
      apiKey: requireApiKey(cfg, 'openai'),
      supportsResponseFormat: true,
      maxTokensField: 'max_completion_tokens',
    });
  },
  async listModels(cfg) {
    return openAiListModels({ providerId: 'openai', baseUrl: baseUrl(cfg.baseUrl), apiKey: requireApiKey(cfg, 'openai') }, 15_000);
  },
};
