import { assertOk, httpFetch } from '../../http/httpClient';
import { AiError, type AiAdapter, type AiProviderConfig, type ChatMessage, type ChatOptions, type ChatResult, type ModelInfo } from '../types';
import { asNumber, pick, requireApiKey, requireModel } from './shared';

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'];

/** Candidate finish reasons that mean the model was stopped by policy rather than by running out of things to say. */
const POLICY_FINISH_REASONS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

function baseUrl(cfg: AiProviderConfig): string {
  return (cfg.baseUrl?.trim() || GEMINI_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/**
 * Build the readable error for a reply without text parts: a blocked prompt (`promptFeedback.blockReason`),
 * a candidate stopped by policy (`finishReason: SAFETY`…), or a genuinely malformed reply.
 */
function noTextError(json: unknown): AiError {
  const blocked = pick(json, 'promptFeedback', 'blockReason');
  if (typeof blocked === 'string' && blocked) {
    return new AiError(`gemini: prompt blocked (${blocked})`, 'invalid-request', 'gemini');
  }
  const finishReason = pick(json, 'candidates', 0, 'finishReason');
  if (typeof finishReason === 'string' && finishReason) {
    const kind = POLICY_FINISH_REASONS.has(finishReason) ? 'invalid-request' : 'parse';
    return new AiError(`gemini: no text returned (finishReason: ${finishReason})`, kind, 'gemini');
  }
  return new AiError('gemini: reply has no candidates[0].content.parts', 'parse', 'gemini');
}

/** Google Gemini via the public REST API (`generateContent`), authenticated with the `x-goog-api-key` header. */
export const geminiAdapter: AiAdapter = {
  async chat(cfg, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const apiKey = requireApiKey(cfg, 'gemini');
    const model = requireModel(cfg, 'gemini');
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    const generationConfig: Record<string, unknown> = {};
    if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature;
    if (opts.maxTokens !== undefined) generationConfig.maxOutputTokens = opts.maxTokens;
    if (opts.json) generationConfig.responseMimeType = 'application/json';

    const body: Record<string, unknown> = { contents };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

    const url = `${baseUrl(cfg)}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const started = Date.now();
    const res = assertOk(
      await httpFetch(url, { method: 'POST', headers: { 'x-goog-api-key': apiKey }, body, timeoutMs: opts.timeoutMs, signal: opts.signal }),
      url,
      'gemini'
    );
    const json = res.json<unknown>();
    const parts = pick(json, 'candidates', 0, 'content', 'parts');
    if (!Array.isArray(parts)) throw noTextError(json);
    // Thinking models may return `thought: true` parts; they are not the answer.
    const text = parts
      .filter((p) => pick(p, 'thought') !== true)
      .map((p) => pick(p, 'text'))
      .filter((t): t is string => typeof t === 'string')
      .join('');
    const modelVersion = pick(json, 'modelVersion');
    return {
      text,
      model: typeof modelVersion === 'string' && modelVersion ? modelVersion : model,
      providerId: 'gemini',
      usage: {
        inputTokens: asNumber(pick(json, 'usageMetadata', 'promptTokenCount')),
        outputTokens: asNumber(pick(json, 'usageMetadata', 'candidatesTokenCount')),
      },
      latencyMs: Date.now() - started,
    };
  },

  async listModels(cfg): Promise<ModelInfo[]> {
    const apiKey = requireApiKey(cfg, 'gemini');
    const url = `${baseUrl(cfg)}/v1beta/models?pageSize=200`;
    const res = assertOk(await httpFetch(url, { headers: { 'x-goog-api-key': apiKey }, timeoutMs: 15_000 }), url, 'gemini');
    const models = pick(res.json<unknown>(), 'models');
    if (!Array.isArray(models)) throw new AiError('gemini: /models reply has no models[]', 'parse', 'gemini');
    const out: ModelInfo[] = [];
    for (const m of models) {
      const name = pick(m, 'name');
      const methods = pick(m, 'supportedGenerationMethods');
      if (typeof name !== 'string' || !Array.isArray(methods) || !methods.includes('generateContent')) continue;
      const display = pick(m, 'displayName');
      out.push({ id: name.replace(/^models\//, ''), label: typeof display === 'string' ? display : undefined });
    }
    return out;
  },
};
