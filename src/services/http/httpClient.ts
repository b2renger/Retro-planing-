import type { DesktopFetchInit } from '../../types/desktop';

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  json<T = unknown>(): T;
}

export interface HttpInit {
  method?: string;
  headers?: Record<string, string>;
  /** string, or a JSON-serialisable object (sets content-type when not provided). */
  body?: string | Uint8Array | Record<string, unknown> | unknown[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly bodyText: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.desktop?.fetch;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildResponse(ok: boolean, status: number, statusText: string, headers: Record<string, string>, text: string): HttpResponse {
  return {
    ok,
    status,
    statusText,
    headers,
    text,
    json<T>() {
      return JSON.parse(text) as T;
    },
  };
}

/**
 * Single HTTP entry point for every remote call in the app.
 * - Web build: window.fetch (subject to CORS).
 * - Electron build: routed through the main process (`window.desktop.fetch`) so LAN farms and
 *   provider APIs are reachable regardless of CORS headers.
 * Never throws on HTTP error status; use `assertOk` when a non-2xx must become an exception.
 */
export async function httpFetch(url: string, init: HttpInit = {}): Promise<HttpResponse> {
  const headers: Record<string, string> = { ...(init.headers || {}) };
  let body: string | Uint8Array | undefined;
  if (init.body !== undefined) {
    if (typeof init.body === 'string' || init.body instanceof Uint8Array) {
      body = init.body;
    } else {
      body = JSON.stringify(init.body);
      if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  if (isDesktop()) {
    const desktopInit: DesktopFetchInit = {
      method: init.method || 'GET',
      headers,
      timeoutMs: init.timeoutMs,
    };
    if (body instanceof Uint8Array) desktopInit.bodyBase64 = toBase64(body);
    else if (typeof body === 'string') desktopInit.body = body;
    const res = await window.desktop!.fetch(url, desktopInit);
    return buildResponse(res.ok, res.status, res.statusText, res.headers, res.body);
  }

  const controller = new AbortController();
  const timer = init.timeoutMs ? setTimeout(() => controller.abort(), init.timeoutMs) : undefined;
  const onAbort = () => controller.abort();
  init.signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: init.method || 'GET',
      headers,
      body: body as BodyInit | undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const h: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      h[k.toLowerCase()] = v;
    });
    return buildResponse(res.ok, res.status, res.statusText, h, text);
  } finally {
    if (timer) clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

export function assertOk(res: HttpResponse, url: string, context?: string): HttpResponse {
  if (res.ok) return res;
  let detail = res.text.slice(0, 500);
  try {
    const j = JSON.parse(res.text);
    detail = j?.error?.message || j?.error?.code || j?.message || j?.error || detail;
    if (typeof detail !== 'string') detail = JSON.stringify(detail).slice(0, 500);
  } catch {
    /* keep raw text */
  }
  throw new HttpError(`${context ? context + ': ' : ''}HTTP ${res.status} ${res.statusText}${detail ? ' — ' + detail : ''}`, res.status, url, res.text);
}
