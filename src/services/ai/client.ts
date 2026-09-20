import { toAiError } from './errors';
import { extractJson } from './json';
import { getAdapter, PROVIDER_CATALOG } from './registry';
import { AiError, type AiProviderConfig, type ChatMessage, type ChatOptions, type ChatResult, type ModelInfo } from './types';

const DEFAULT_CHAT_TIMEOUT_MS = 120_000;
const JSON_RETRY_NUDGE = 'Return only valid JSON.';
/**
 * Output budget for the connection test. Small, but not tiny: reasoning models (OpenAI gpt-5*,
 * Gemini thinking models) count their hidden reasoning against the limit and return an empty reply
 * when it is only a handful of tokens.
 */
const TEST_CONNECTION_MAX_TOKENS = 256;

/** Throw `not-configured` when the config lacks what its provider family needs. */
function assertConfigured(cfg: AiProviderConfig): void {
  const entry = PROVIDER_CATALOG[cfg.providerId];
  if (!entry) throw new AiError(`Unknown AI provider "${cfg.providerId}"`, 'not-configured');
  if (entry.requiresKey && !cfg.apiKey?.trim()) throw new AiError(`${entry.label}: API key is missing`, 'not-configured', cfg.providerId);
  if (entry.requiresBaseUrl && !cfg.baseUrl?.trim()) throw new AiError(`${entry.label}: base URL is missing`, 'not-configured', cfg.providerId);
}

/** Send a chat request through the configured provider. Always throws AiError on failure. */
export async function chat(cfg: AiProviderConfig, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  assertConfigured(cfg);
  try {
    return await getAdapter(cfg.providerId).chat(cfg, messages, { timeoutMs: DEFAULT_CHAT_TIMEOUT_MS, ...opts });
  } catch (err) {
    throw toAiError(err, cfg.providerId);
  }
}

/** A parsed JSON reply plus the raw chat result it came from. */
export interface ChatJsonResult<T> {
  data: T;
  result: ChatResult;
  /** True when the first reply did not parse and a second request was needed. */
  retried: boolean;
}

/**
 * Chat in JSON mode and parse the reply. When the first reply is not valid JSON, retries once with
 * a nudge ("Return only valid JSON."); a second parse failure throws AiError('parse').
 */
export async function chatJson<T = unknown>(cfg: AiProviderConfig, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatJsonResult<T>> {
  const jsonOpts: ChatOptions = { ...opts, json: true };
  const first = await chat(cfg, messages, jsonOpts);
  try {
    return { data: extractJson<T>(first.text, cfg.providerId), result: first, retried: false };
  } catch (err) {
    if (!(err instanceof AiError) || err.kind !== 'parse') throw err;
  }
  const retryMessages: ChatMessage[] = [...messages];
  if (first.text.trim()) retryMessages.push({ role: 'assistant', content: first.text });
  retryMessages.push({ role: 'user', content: JSON_RETRY_NUDGE });
  const second = await chat(cfg, retryMessages, jsonOpts);
  return { data: extractJson<T>(second.text, cfg.providerId), result: second, retried: true };
}

/** Live model list, or the catalog's static list when the provider could not be asked. */
export interface ListModelsResult {
  models: ModelInfo[];
  /** True when the live listing failed and the catalog's static list was returned instead. */
  fromFallback: boolean;
  error?: AiError;
}

/** List the provider's models; on any failure returns the catalog fallback list flagged `fromFallback`. */
export async function listModels(cfg: AiProviderConfig): Promise<ListModelsResult> {
  const fallback = () => PROVIDER_CATALOG[cfg.providerId]?.fallbackModels.map((id) => ({ id })) ?? [];
  try {
    assertConfigured(cfg);
    const models = await getAdapter(cfg.providerId).listModels(cfg);
    if (models.length === 0) return { models: fallback(), fromFallback: true };
    return { models, fromFallback: false };
  } catch (err) {
    const error = toAiError(err, cfg.providerId);
    console.warn(`[ai] listModels failed for ${cfg.providerId}, using fallback list: ${error.message}`);
    return { models: fallback(), fromFallback: true, error };
  }
}

/** Outcome of `testConnection`; `ok: false` carries the mapped error kind and message. */
export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  message: string;
  sampleReply?: string;
  errorKind?: AiError['kind'];
}

/** Round-trip a tiny prompt to verify credentials, endpoint and model. Never throws. */
export async function testConnection(cfg: AiProviderConfig): Promise<ConnectionTestResult> {
  const started = Date.now();
  try {
    const res = await chat(cfg, [{ role: 'user', content: 'Reply with the single word OK' }], { maxTokens: TEST_CONNECTION_MAX_TOKENS, timeoutMs: 20_000 });
    const sampleReply = res.text.trim();
    return {
      ok: true,
      latencyMs: Date.now() - started,
      model: res.model,
      message: `Connected to ${PROVIDER_CATALOG[cfg.providerId]?.label ?? cfg.providerId} (${res.model}) in ${res.latencyMs} ms`,
      sampleReply,
    };
  } catch (err) {
    const error = toAiError(err, cfg.providerId);
    return { ok: false, latencyMs: Date.now() - started, model: cfg.model, message: error.message, errorKind: error.kind };
  }
}
