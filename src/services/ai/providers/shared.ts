import { assertOk, httpFetch } from '../../http/httpClient';
import { AiError, type AiProviderConfig, type AiProviderId, type ChatMessage, type ChatOptions, type ChatResult, type ModelInfo } from '../types';

/**
 * Instruction added in JSON mode when no message mentions JSON. OpenAI returns HTTP 400 for
 * `response_format: json_object` unless the word "JSON" appears in the conversation, and local servers
 * (which get no `response_format` at all) need the instruction to know what is expected.
 */
export const JSON_MODE_HINT = 'Respond with a single JSON object only, no markdown fences.';

/** Throw `not-configured` unless the config carries a non-empty API key. */
export function requireApiKey(cfg: AiProviderConfig, providerId: AiProviderId): string {
  const key = cfg.apiKey?.trim();
  if (!key) throw new AiError(`${providerId}: API key is missing`, 'not-configured', providerId);
  return key;
}

/** Throw `not-configured` unless the config carries a non-empty model. */
export function requireModel(cfg: AiProviderConfig, providerId: AiProviderId): string {
  const model = cfg.model?.trim();
  if (!model) throw new AiError(`${providerId}: model is missing`, 'not-configured', providerId);
  return model;
}

/** Read a nested value from an untyped JSON payload, returning undefined on any miss. */
export function pick(obj: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** The value when it is a finite number, else undefined. */
export function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Guarantee the conversation mentions JSON: appends the hint to the first system message, or
 * prepends a system message when there is none. Returns the input untouched when JSON is already mentioned.
 */
export function ensureJsonMention(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some((m) => /json/i.test(m.content))) return messages;
  const systemIndex = messages.findIndex((m) => m.role === 'system');
  if (systemIndex < 0) return [{ role: 'system', content: JSON_MODE_HINT }, ...messages];
  return messages.map((m, i) => (i === systemIndex ? { ...m, content: `${m.content}\n\n${JSON_MODE_HINT}` } : m));
}

export interface OpenAiWireOptions {
  providerId: AiProviderId;
  baseUrl: string;
  apiKey?: string;
  /** Send `response_format: {type:'json_object'}` when `opts.json` is set. */
  supportsResponseFormat: boolean;
  /** OpenAI proper deprecated `max_tokens` in favour of `max_completion_tokens`. */
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
}

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

/** `POST {baseUrl}/chat/completions` in the OpenAI wire format, shared by OpenAI, Mistral and local servers. */
export async function openAiChat(cfg: AiProviderConfig, messages: ChatMessage[], opts: ChatOptions, wire: OpenAiWireOptions): Promise<ChatResult> {
  const model = requireModel(cfg, wire.providerId);
  const wireMessages = opts.json ? ensureJsonMention(messages) : messages;
  const body: Record<string, unknown> = {
    model,
    messages: wireMessages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body[wire.maxTokensField] = opts.maxTokens;
  if (opts.json && wire.supportsResponseFormat) body.response_format = { type: 'json_object' };

  const url = `${wire.baseUrl}/chat/completions`;
  const started = Date.now();
  const res = assertOk(
    await httpFetch(url, { method: 'POST', headers: authHeaders(wire.apiKey), body, timeoutMs: opts.timeoutMs, signal: opts.signal }),
    url,
    wire.providerId
  );
  const json = res.json<unknown>();
  const choice = pick(json, 'choices', 0);
  const content = pick(choice, 'message', 'content');
  if (typeof content !== 'string') {
    // `content` is null on refusals and tool calls; say why rather than "no content".
    const refusal = pick(choice, 'message', 'refusal');
    const finishReason = pick(choice, 'finish_reason');
    const detail =
      typeof refusal === 'string' && refusal.trim()
        ? `model refused: ${refusal.trim()}`
        : typeof finishReason === 'string'
          ? `reply has no text content (finish_reason: ${finishReason})`
          : 'reply has no choices[0].message.content';
    throw new AiError(`${wire.providerId}: ${detail}`, 'parse', wire.providerId);
  }
  const replyModel = pick(json, 'model');
  return {
    text: content,
    model: typeof replyModel === 'string' && replyModel ? replyModel : model,
    providerId: wire.providerId,
    usage: { inputTokens: asNumber(pick(json, 'usage', 'prompt_tokens')), outputTokens: asNumber(pick(json, 'usage', 'completion_tokens')) },
    latencyMs: Date.now() - started,
  };
}

/** `GET {baseUrl}/models` → sorted `data[].id`. */
export async function openAiListModels(wire: Pick<OpenAiWireOptions, 'providerId' | 'baseUrl' | 'apiKey'>, timeoutMs?: number): Promise<ModelInfo[]> {
  const url = `${wire.baseUrl}/models`;
  const res = assertOk(await httpFetch(url, { headers: authHeaders(wire.apiKey), timeoutMs }), url, wire.providerId);
  const data = pick(res.json<unknown>(), 'data');
  if (!Array.isArray(data)) throw new AiError(`${wire.providerId}: /models reply has no data[]`, 'parse', wire.providerId);
  return data
    .map((m) => pick(m, 'id'))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id }));
}
