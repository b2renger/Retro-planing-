/**
 * Bridge exposed by the Electron preload script as `window.desktop`.
 * Absent in the plain web build — every consumer must feature-detect it.
 */
export interface DesktopFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  /** Response body as UTF-8 text (JSON callers parse it themselves). */
  body: string;
}

export interface DesktopFetchInit {
  method?: string;
  headers?: Record<string, string>;
  /** Request body as text. Binary uploads use `bodyBase64`. */
  body?: string;
  bodyBase64?: string;
  timeoutMs?: number;
}

export interface DiscoveredFarm {
  /** e.g. http://192.168.1.20:4000/v1 */
  endpoint: string;
  host: string;
  name?: string;
  model?: string;
  capacity?: { slots?: number; clients?: number };
  raw: unknown;
  lastSeen: string;
}

export interface OAuthLoopbackResult {
  /** Full redirect URL received on the loopback server (contains code / error). */
  redirectUrl: string;
  /** The redirect_uri that was registered for this attempt (http://127.0.0.1:<port>/callback). */
  redirectUri: string;
}

export interface DesktopBridge {
  platform: 'darwin' | 'win32' | 'linux';
  version: string;
  /** CORS-free fetch executed in the main process. */
  fetch(url: string, init?: DesktopFetchInit): Promise<DesktopFetchResponse>;
  /** Listen for LlmOnLan UDP beacons for `durationMs` and return the farms seen. */
  discoverFarms(durationMs?: number): Promise<DiscoveredFarm[]>;
  /**
   * Start a loopback server, return its redirect_uri; then open `buildAuthUrl(redirectUri)` in the
   * system browser and resolve when the browser hits the callback.
   */
  oauthLoopback(buildAuthUrl: (redirectUri: string) => string): Promise<OAuthLoopbackResult>;
  openExternal(url: string): Promise<void>;
  secureStore: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  saveFile(opts: { defaultPath: string; dataBase64: string; mimeType?: string }): Promise<{ saved: boolean; path?: string }>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
