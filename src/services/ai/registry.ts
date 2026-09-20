import type { AiAdapter, AiProviderId } from './types';
import { anthropicAdapter, ANTHROPIC_DEFAULT_BASE_URL, ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_FALLBACK_MODELS } from './providers/anthropic';
import { geminiAdapter, GEMINI_DEFAULT_BASE_URL, GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODELS } from './providers/gemini';
import { mistralAdapter, MISTRAL_DEFAULT_BASE_URL, MISTRAL_DEFAULT_MODEL, MISTRAL_FALLBACK_MODELS } from './providers/mistral';
import { openaiAdapter, OPENAI_DEFAULT_BASE_URL, OPENAI_DEFAULT_MODEL, OPENAI_FALLBACK_MODELS } from './providers/openai';
import { llmOnLanAdapter, openaiCompatibleAdapter } from './providers/openaiCompatible';

/** Static description of one provider family, for the settings UI and the client. */
export interface ProviderCatalogEntry {
  label: string;
  /** Endpoint used when the config has none; absent for providers that must be pointed at a server. */
  defaultBaseUrl?: string;
  requiresKey: boolean;
  requiresBaseUrl: boolean;
  canListModels: boolean;
  defaultModel: string;
  fallbackModels: string[];
  docsUrl: string;
  keyHint: string;
}

/** Static description of every supported provider, for the settings UI and the client. */
export const PROVIDER_CATALOG: Record<AiProviderId, ProviderCatalogEntry> = {
  gemini: {
    label: 'Google Gemini',
    defaultBaseUrl: GEMINI_DEFAULT_BASE_URL,
    requiresKey: true,
    requiresBaseUrl: false,
    canListModels: true,
    defaultModel: GEMINI_DEFAULT_MODEL,
    fallbackModels: GEMINI_FALLBACK_MODELS,
    docsUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: OPENAI_DEFAULT_BASE_URL,
    requiresKey: true,
    requiresBaseUrl: false,
    canListModels: true,
    defaultModel: OPENAI_DEFAULT_MODEL,
    fallbackModels: OPENAI_FALLBACK_MODELS,
    docsUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
  },
  anthropic: {
    label: 'Anthropic Claude',
    defaultBaseUrl: ANTHROPIC_DEFAULT_BASE_URL,
    requiresKey: true,
    requiresBaseUrl: false,
    canListModels: true,
    defaultModel: ANTHROPIC_DEFAULT_MODEL,
    fallbackModels: ANTHROPIC_FALLBACK_MODELS,
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
  },
  mistral: {
    label: 'Mistral',
    defaultBaseUrl: MISTRAL_DEFAULT_BASE_URL,
    requiresKey: true,
    requiresBaseUrl: false,
    canListModels: true,
    defaultModel: MISTRAL_DEFAULT_MODEL,
    fallbackModels: MISTRAL_FALLBACK_MODELS,
    docsUrl: 'https://console.mistral.ai/api-keys',
    keyHint: 'Mistral API key',
  },
  'openai-compatible': {
    label: 'OpenAI-compatible server (Ollama, LM Studio, vLLM…)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresKey: false,
    requiresBaseUrl: true,
    canListModels: true,
    defaultModel: '',
    fallbackModels: [],
    docsUrl: 'https://ollama.com/blog/openai-compatibility',
    keyHint: 'Optional — only if the server requires one',
  },
  llmonlan: {
    label: 'LlmOnLan farm (LAN)',
    requiresKey: false,
    requiresBaseUrl: true,
    canListModels: true,
    defaultModel: '',
    fallbackModels: [],
    docsUrl: 'https://github.com/b2renger/LlmOnLan',
    keyHint: 'Optional master key (Bearer)',
  },
};

const ADAPTERS: Record<AiProviderId, AiAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  mistral: mistralAdapter,
  'openai-compatible': openaiCompatibleAdapter,
  llmonlan: llmOnLanAdapter,
};

/** Resolve the adapter for a provider family. */
export function getAdapter(providerId: AiProviderId): AiAdapter {
  const adapter = ADAPTERS[providerId];
  if (!adapter) throw new Error(`Unknown AI provider: ${providerId}`);
  return adapter;
}
