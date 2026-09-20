import { httpFetch, type HttpInit, type HttpResponse } from '../http/httpClient';
import { CloudError, type CloudErrorKind } from './types';

/** Extracts a human readable message from a JSON or text error body. */
function extractMessage(text: string): string {
  try {
    const j: unknown = JSON.parse(text);
    if (j && typeof j === 'object') {
      // OAuth token endpoints: { error: 'invalid_grant', error_description: '...' }
      const desc = (j as { error_description?: unknown }).error_description;
      if (typeof desc === 'string') return desc;
      const err = (j as { error?: unknown }).error;
      if (typeof err === 'string') return err;
      if (err && typeof err === 'object') {
        const msg = (err as { message?: unknown }).message;
        if (typeof msg === 'string') return msg;
        const code = (err as { code?: unknown }).code;
        if (typeof code === 'string') return code;
      }
      const message = (j as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  } catch {
    /* not JSON */
  }
  return text.slice(0, 300);
}

/** Maps an HTTP status (plus body hints) to a `CloudErrorKind`. */
export function kindForStatus(status: number, bodyText: string): CloudErrorKind {
  if (status === 401) return 'auth';
  if (status === 404) return 'not-found';
  if (status === 409 || status === 412) return 'conflict';
  if (status === 429 || status === 507) return 'quota';
  if (status === 403) {
    const lower = bodyText.toLowerCase();
    if (lower.includes('storagequotaexceeded') || lower.includes('quota')) return 'quota';
    return 'auth';
  }
  if (status >= 500) return 'network';
  return 'unknown';
}

/** Converts a non-2xx `HttpResponse` into a thrown `CloudError`. */
export function throwCloudError(res: HttpResponse, context: string): never {
  const kind = kindForStatus(res.status, res.text);
  const detail = extractMessage(res.text);
  throw new CloudError(kind, `${context}: HTTP ${res.status}${detail ? ' — ' + detail : ''}`, res.status);
}

/**
 * `httpFetch` wrapper for the cloud layer: transport failures become `CloudError('network')`
 * and non-2xx responses become typed `CloudError`s. Returns the response on success.
 */
export async function cloudFetch(url: string, init: HttpInit, context: string): Promise<HttpResponse> {
  let res: HttpResponse;
  try {
    res = await httpFetch(url, init);
  } catch (err) {
    if (err instanceof CloudError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new CloudError('network', `${context}: ${msg}`);
  }
  if (!res.ok) throwCloudError(res, context);
  return res;
}

/** Narrow helper: `value` is a non-null object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a string property, or `undefined` when absent / not a string. */
export function str(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

/** Reads a numeric property (accepting numeric strings, as Drive returns `size` as a string). */
export function num(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
