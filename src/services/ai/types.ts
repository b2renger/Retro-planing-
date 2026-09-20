/**
 * Provider-agnostic AI layer: shared types.
 * Every adapter speaks this contract so the UI never depends on a vendor SDK.
 */

/** Identifiers of the supported provider families. */
export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'mistral' | 'openai-compatible' | 'llmonlan';

/** One configured provider instance (a user may have several, e.g. two farms). */
export interface AiProviderConfig {
  /** Instance id (uuid-ish), distinct from `providerId`. */
  id: string;
  providerId: AiProviderId;
  /** Human label shown in settings, e.g. "Studio LM Studio". */
  label: string;
  apiKey?: string;
  /** Overrides the provider's default endpoint; required for self-hosted providers. */
  baseUrl?: string;
  model: string;
  enabled: boolean;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for a JSON object reply (adapters translate this to their own flag or prompt). */
  json?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ChatUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  providerId: AiProviderId;
  usage?: ChatUsage;
  latencyMs: number;
}

export interface ModelInfo {
  id: string;
  label?: string;
}

export type AiErrorKind = 'auth' | 'network' | 'rate-limit' | 'invalid-request' | 'not-configured' | 'parse' | 'unknown';

/** The only error type callers of the AI layer ever see. */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly providerId: AiProviderId | 'unknown';
  readonly status?: number;

  constructor(message: string, kind: AiErrorKind, providerId: AiProviderId | 'unknown' = 'unknown', status?: number) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    this.providerId = providerId;
    this.status = status;
  }
}

/** What each provider module implements. */
export interface AiAdapter {
  chat(cfg: AiProviderConfig, messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  listModels(cfg: AiProviderConfig): Promise<ModelInfo[]>;
}
