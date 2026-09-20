import { HttpError } from '../http/httpClient';
import { AiError, type AiErrorKind, type AiProviderId } from './types';

/** Map an HTTP status to an AiError kind. */
export function kindFromStatus(status: number): AiErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limit';
  if (status === 400 || status === 404 || status === 422) return 'invalid-request';
  return 'unknown';
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name?: unknown }).name === 'AbortError';
}

/**
 * Errors that crossed the Electron IPC bridge arrive as plain `Error`s (the name is lost), with the
 * main process's wording: "Network error for <url>: …" or "Request to <url> timed out". Node/undici
 * and browsers also phrase connection failures in a few recognisable ways.
 */
const NETWORK_MESSAGE_RE = /^(network error for |request to .* timed out)|\b(ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|fetch failed|failed to fetch|load failed|networkerror)\b/i;

/**
 * Normalise anything thrown by an adapter (HttpError, fetch TypeError, abort, plain Error) into an AiError.
 * AiErrors pass through untouched.
 */
export function toAiError(err: unknown, providerId: AiProviderId): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof HttpError) {
    return new AiError(err.message, kindFromStatus(err.status), providerId, err.status);
  }
  if (isAbort(err)) {
    return new AiError('Request aborted or timed out', 'network', providerId);
  }
  if (err instanceof TypeError) {
    return new AiError(`Network error: ${err.message}`, 'network', providerId);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (NETWORK_MESSAGE_RE.test(message)) return new AiError(message, 'network', providerId);
  return new AiError(message, 'unknown', providerId);
}
