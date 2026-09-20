import { assertOk, httpFetch } from '../../http/httpClient';
import { AiError, type AiAdapter, type AiProviderConfig, type ChatMessage, type ChatOptions, type ChatResult, type ModelInfo } from '../types';
import { asNumber, pick, requireApiKey, requireModel } from './shared';

export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5';
export const ANTHROPIC_FALLBACK_MODELS = ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'];
export const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;
const JSON_INSTRUCTION = 'Respond with a single JSON object only, no markdown fences.';

interface AnthropicTurn {
  role: 'user' | 'assistant';
  content: string;
}

function baseUrl(cfg: AiProviderConfig): string {
  return (cfg.baseUrl?.trim() || ANTHROPIC_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function headers(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/**
 * Shape the conversation the way the Messages API requires: no system turns (they go in `system`),
 * no empty turns (rejected), consecutive same-role turns merged, and a trailing assistant turn
 * trimmed (the API refuses a prefill that ends with whitespace). Throws `invalid-request` when the
 * result does not start with a user turn.
 */
function toTurns(messages: ChatMessage[]): AnthropicTurn[] {
  const turns: AnthropicTurn[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const content = typeof m.content === 'string' ? m.content : '';
    if (!content.trim()) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${content}`;
    else turns.push({ role: m.role, content });
  }
  const last = turns[turns.length - 1];
  if (last && last.role === 'assistant') last.content = last.content.trimEnd();
  if (!turns.length || turns[0].role !== 'user') {
    throw new AiError('anthropic: the conversation must start with a non-empty user message', 'invalid-request', 'anthropic');
  }
  return turns;
}

/** Anthropic Messages API. JSON mode is a system-prompt instruction (the API has no response_format). */
export const anthropicAdapter: AiAdapter = {
  async chat(cfg, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const apiKey = requireApiKey(cfg, 'anthropic');
    const model = requireModel(cfg, 'anthropic');
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    if (opts.json) systemParts.push(JSON_INSTRUCTION);
    const system = systemParts.join('\n\n');

    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: toTurns(messages),
    };
    if (system) body.system = system;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;

    const url = `${baseUrl(cfg)}/v1/messages`;
    const started = Date.now();
    const res = assertOk(
      await httpFetch(url, { method: 'POST', headers: headers(apiKey), body, timeoutMs: opts.timeoutMs, signal: opts.signal }),
      url,
      'anthropic'
    );
    const json = res.json<unknown>();
    const content = pick(json, 'content');
    if (!Array.isArray(content)) throw new AiError('anthropic: reply has no content[]', 'parse', 'anthropic');
    const text = content
      .filter((c) => pick(c, 'type') === 'text')
      .map((c) => pick(c, 'text'))
      .filter((t): t is string => typeof t === 'string')
      .join('');
    const stopReason = pick(json, 'stop_reason');
    if (!text && typeof stopReason === 'string' && stopReason !== 'end_turn') {
      // e.g. `refusal`, or `max_tokens` spent entirely on thinking: say so instead of returning ''.
      throw new AiError(`anthropic: no text returned (stop_reason: ${stopReason})`, stopReason === 'refusal' ? 'invalid-request' : 'parse', 'anthropic');
    }
    const replyModel = pick(json, 'model');
    return {
      text,
      model: typeof replyModel === 'string' && replyModel ? replyModel : model,
      providerId: 'anthropic',
      usage: { inputTokens: asNumber(pick(json, 'usage', 'input_tokens')), outputTokens: asNumber(pick(json, 'usage', 'output_tokens')) },
      latencyMs: Date.now() - started,
    };
  },

  async listModels(cfg): Promise<ModelInfo[]> {
    const apiKey = requireApiKey(cfg, 'anthropic');
    const url = `${baseUrl(cfg)}/v1/models?limit=100`;
    const res = assertOk(await httpFetch(url, { headers: headers(apiKey), timeoutMs: 15_000 }), url, 'anthropic');
    const data = pick(res.json<unknown>(), 'data');
    if (!Array.isArray(data)) throw new AiError('anthropic: /models reply has no data[]', 'parse', 'anthropic');
    return data
      .map((m) => ({ id: pick(m, 'id'), label: pick(m, 'display_name') }))
      .filter((m): m is { id: string; label: unknown } => typeof m.id === 'string' && m.id.length > 0)
      .map((m) => ({ id: m.id, label: typeof m.label === 'string' ? m.label : undefined }));
  },
};
