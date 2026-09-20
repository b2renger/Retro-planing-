import { AiError, type AiAdapter, type AiProviderConfig, type AiProviderId, type ChatOptions } from '../types';
import { openAiChat, openAiListModels } from './shared';

export const LLMONLAN_DEFAULT_PORT = 4000;

const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const HAS_V1_RE = /\/v1(\/|$)/;

/**
 * Normalise a user-typed OpenAI-compatible base URL:
 * adds `http://` when the scheme is missing, strips trailing slashes, appends `/v1` when the path has none.
 * The port is left exactly as typed (`192.168.1.20` → `http://192.168.1.20/v1`).
 */
export function normalizeOpenAiBaseUrl(input: string): string {
  let url = (input || '').trim();
  if (!url) return '';
  if (!HAS_SCHEME_RE.test(url)) url = `http://${url}`;
  url = url.replace(/\/+$/, '');
  if (!HAS_V1_RE.test(url)) url = `${url}/v1`;
  return url;
}

/**
 * Same as `normalizeOpenAiBaseUrl`, but also defaults the port to 4000 (LlmOnLan's) when none is given:
 * `192.168.1.20` → `http://192.168.1.20:4000/v1`.
 */
export function normalizeLlmOnLanEndpoint(input: string): string {
  const normalized = normalizeOpenAiBaseUrl(input);
  if (!normalized) return '';
  try {
    const u = new URL(normalized);
    if (!u.port) u.port = String(LLMONLAN_DEFAULT_PORT);
    return u.toString().replace(/\/+$/, '');
  } catch {
    return normalized;
  }
}

function resolveBaseUrl(cfg: AiProviderConfig, providerId: AiProviderId): string {
  const url = normalizeOpenAiBaseUrl(cfg.baseUrl || '');
  if (!url) throw new AiError(`${providerId}: base URL is required`, 'not-configured', providerId);
  return url;
}

function keyOf(cfg: AiProviderConfig): string | undefined {
  const k = cfg.apiKey?.trim();
  return k ? k : undefined;
}

/**
 * Build an adapter for any server that speaks the OpenAI Chat Completions format
 * (Ollama, LM Studio, vLLM, LlmOnLan farms…). Key optional, no `response_format` (many local servers reject it).
 */
export function createOpenAiCompatibleAdapter(providerId: AiProviderId): AiAdapter {
  return {
    async chat(cfg, messages, opts: ChatOptions = {}) {
      return openAiChat(cfg, messages, opts, {
        providerId,
        baseUrl: resolveBaseUrl(cfg, providerId),
        apiKey: keyOf(cfg),
        supportsResponseFormat: false,
        maxTokensField: 'max_tokens',
      });
    },
    async listModels(cfg) {
      return openAiListModels({ providerId, baseUrl: resolveBaseUrl(cfg, providerId), apiKey: keyOf(cfg) }, 10_000);
    },
  };
}

export const openaiCompatibleAdapter: AiAdapter = createOpenAiCompatibleAdapter('openai-compatible');
export const llmOnLanAdapter: AiAdapter = createOpenAiCompatibleAdapter('llmonlan');
