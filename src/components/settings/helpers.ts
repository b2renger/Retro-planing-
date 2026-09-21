/**
 * Pure helpers behind the settings panels. Kept out of the components so they can be unit tested
 * without a DOM (see `helpers.test.ts`).
 */
import { normalizeLlmOnLanEndpoint, normalizeOpenAiBaseUrl } from '../../services/ai/providers/openaiCompatible';
import { PROVIDER_CATALOG } from '../../services/ai/registry';
import type { AiProviderConfig, AiProviderId } from '../../services/ai/types';

/** One-line description of each provider family, shown on the "add provider" cards. */
export const PROVIDER_BLURB: Record<AiProviderId, string> = {
  gemini: 'Google’s hosted models. Free tier available, key from AI Studio.',
  openai: 'GPT models on api.openai.com. Billed per token.',
  anthropic: 'Claude models on api.anthropic.com. Billed per token.',
  mistral: 'Mistral’s hosted models, European infrastructure.',
  'openai-compatible': 'Any server speaking the OpenAI API: Ollama, LM Studio, vLLM, llama.cpp.',
  llmonlan: 'A LlmOnLan farm on your own network. Nothing leaves the LAN; discovery needs the desktop app.',
};

/**
 * What the app will actually call, for the line shown under a base-URL input.
 * LlmOnLan defaults the port to 4000; every other family keeps the port as typed.
 * Returns `''` for empty input so the caller can hide the line.
 */
export function displayEndpoint(input: string, providerId: AiProviderId): string {
  if (!input.trim()) return '';
  return providerId === 'llmonlan' ? normalizeLlmOnLanEndpoint(input) : normalizeOpenAiBaseUrl(input);
}

/** Human names of the fields this provider family still needs before it can be called. */
export function missingRequirements(providerId: AiProviderId, draft: { apiKey?: string; baseUrl?: string; model?: string }): string[] {
  const entry = PROVIDER_CATALOG[providerId];
  const missing: string[] = [];
  if (!entry) return ['A known provider family'];
  if (entry.requiresKey && !draft.apiKey?.trim()) missing.push('API key');
  if (entry.requiresBaseUrl && !draft.baseUrl?.trim()) missing.push('Base URL');
  if (!draft.model?.trim()) missing.push('Model');
  return missing;
}

/** True when the provider can be asked for its model list right now. */
export function canLoadModels(providerId: AiProviderId, draft: { apiKey?: string; baseUrl?: string }): boolean {
  const entry = PROVIDER_CATALOG[providerId];
  if (!entry?.canListModels) return false;
  if (entry.requiresKey && !draft.apiKey?.trim()) return false;
  if (entry.requiresBaseUrl && !draft.baseUrl?.trim()) return false;
  return true;
}

/** `Label`, `Label 2`, `Label 3`… — first name not already taken (case-insensitive). */
export function uniqueLabel(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  if (!used.has(base.trim().toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** Byte count as B / kB / MB with one decimal above 1 kB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Build the config the AI layer takes from an in-progress form, without committing it to the store. */
export function draftToConfig(draft: {
  id?: string;
  providerId: AiProviderId;
  label: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}): AiProviderConfig {
  const entry = PROVIDER_CATALOG[draft.providerId];
  const baseUrl = draft.baseUrl?.trim() ? displayEndpoint(draft.baseUrl, draft.providerId) : entry?.defaultBaseUrl;
  return {
    id: draft.id ?? 'draft',
    providerId: draft.providerId,
    label: draft.label.trim() || entry?.label || draft.providerId,
    apiKey: draft.apiKey?.trim() || undefined,
    baseUrl,
    model: draft.model.trim(),
    enabled: true,
  };
}
