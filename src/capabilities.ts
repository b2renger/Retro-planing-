/**
 * What this build can actually do.
 *
 * One module, one detection point. Nothing in `src/components` or `src/hooks` should read
 * `window.desktop` itself: a feature that cannot work here must be hidden or explained, never
 * rendered as a button that does nothing.
 *
 * Two different reasons make a feature unavailable, and they are not the same reason:
 *
 * 1. **No bridge.** UDP multicast discovery, the OS keychain, the loopback OAuth server and the
 *    native save dialog only exist in the Electron build (`window.desktop`).
 * 2. **The page's own origin.** A page served over `https:` cannot call `http://192.168.1.20:4000`
 *    — the browser blocks mixed content before the request leaves the machine. So the GitHub Pages
 *    build cannot reach a LAN farm even though the code is identical, while the same code served
 *    from `http://localhost:5173` during development can.
 *
 * `canUseLanFarms` is deliberately a pure function of `{ hasDesktop, protocol }` so both reasons are
 * testable without a browser.
 */
import type { DesktopBridge } from './types/desktop';

/** Where API keys and OAuth secrets end up on this build. */
export type SecretsBackend = 'keychain' | 'localStorage';

/** The raw facts capabilities are derived from. Every field is an input, never a lookup. */
export interface CapabilityEnv {
  /** The Electron preload bridge is present. */
  hasDesktop: boolean;
  /** `location.protocol`, e.g. `'https:'`, `'http:'`, `'file:'`. */
  protocol: string;
  /** The bridge exposes `discoverFarms`. Defaults to `hasDesktop`. */
  hasFarmDiscovery?: boolean;
  /** The bridge exposes an OS keychain-backed secure store. Defaults to `hasDesktop`. */
  hasSecureStore?: boolean;
  /** The bridge exposes the loopback OAuth server. Defaults to `hasDesktop`. */
  hasOauthLoopback?: boolean;
  /** The bridge can open a URL in the system browser. Defaults to `hasDesktop`. */
  hasOpenExternal?: boolean;
  /** The bridge exposes the native save dialog. Defaults to `hasDesktop`. */
  hasSaveFile?: boolean;
  /** `localStorage` is readable and writable. Defaults to `true`. */
  hasLocalStorage?: boolean;
  /** `window.desktop.platform`, when there is a bridge. */
  desktopPlatform?: string;
  /** `window.desktop.version`, when there is a bridge. */
  desktopVersion?: string;
}

export interface Capabilities {
  hasDesktop: boolean;
  /** Multicast beacons can be received: desktop only, a browser has no UDP socket. */
  canDiscoverFarms: boolean;
  /** A LlmOnLan farm on a plain-http LAN address can actually be called from here. */
  canUseLanFarms: boolean;
  /** OAuth can use the loopback + system browser flow rather than a redirect back into the page. */
  canOauthLoopback: boolean;
  /** A link can be handed to the system browser instead of a new tab. */
  canOpenExternal: boolean;
  /** Exports go through a real save dialog rather than a browser download. */
  canSaveNatively: boolean;
  secretsBackend: SecretsBackend;
  /** False when even `localStorage` is unavailable — keys then live in memory only. */
  secretsPersisted: boolean;
  /** The sentence the settings screens show about where keys are kept. No claim beyond the fact. */
  keyStorageNote: string;
  platformLabel: 'Desktop app' | 'Browser';
  /** Same, with the Electron details when there are any: `Desktop app (darwin, Electron 32.1.0)`. */
  buildLabel: string;
}

/** Where the README explains how to get the desktop build. */
export const DESKTOP_DOWNLOAD_URL = 'https://github.com/b2renger/Retro-planing-#the-desktop-app';

/**
 * Can this build call a LlmOnLan farm at a plain-http LAN address?
 *
 * - Desktop: yes. The request is made by the main process, which no page policy applies to.
 * - Browser on `http:` (local dev, or the app served from a LAN machine): yes, same-scheme.
 * - Browser on `https:` (GitHub Pages): **no**. Mixed content is blocked before the request is sent,
 *   so offering the farm form here would only produce a network error the user cannot fix.
 */
export function canUseLanFarms({ hasDesktop, protocol }: { hasDesktop: boolean; protocol: string }): boolean {
  if (hasDesktop) return true;
  return protocol !== 'https:';
}

/** The copy that goes with `secretsBackend`. */
export function keyStorageNote(backend: SecretsBackend, persisted: boolean): string {
  if (backend === 'keychain') {
    return 'Keys are encrypted by your operating system keychain and never written to the app’s own files.';
  }
  if (!persisted) {
    return 'No storage is available on this device, so keys live in memory only and are lost when the page reloads.';
  }
  return 'Keys are stored in this browser’s local storage, in clear text. Anything that can run script on this page can read them.';
}

/** Pure: facts in, capabilities out. */
export function computeCapabilities(env: CapabilityEnv): Capabilities {
  const hasDesktop = env.hasDesktop;
  const backend: SecretsBackend = (env.hasSecureStore ?? hasDesktop) ? 'keychain' : 'localStorage';
  const secretsPersisted = backend === 'keychain' ? true : (env.hasLocalStorage ?? true);
  const details = [env.desktopPlatform, env.desktopVersion ? `Electron ${env.desktopVersion}` : null].filter(Boolean);
  return {
    hasDesktop,
    canDiscoverFarms: (env.hasFarmDiscovery ?? hasDesktop) && hasDesktop,
    canUseLanFarms: canUseLanFarms({ hasDesktop, protocol: env.protocol }),
    canOauthLoopback: (env.hasOauthLoopback ?? hasDesktop) && hasDesktop,
    canOpenExternal: (env.hasOpenExternal ?? hasDesktop) && hasDesktop,
    canSaveNatively: (env.hasSaveFile ?? hasDesktop) && hasDesktop,
    secretsBackend: backend,
    secretsPersisted,
    keyStorageNote: keyStorageNote(backend, secretsPersisted),
    platformLabel: hasDesktop ? 'Desktop app' : 'Browser',
    buildLabel: hasDesktop && details.length ? `Desktop app (${details.join(', ')})` : hasDesktop ? 'Desktop app' : 'Browser',
  };
}

/** The Electron bridge, or `undefined` in a browser. The ONLY place `window.desktop` is read. */
export function desktopBridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' ? window.desktop : undefined;
}

function localStorageWorks(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

/** Reads the current environment. Not memoised — the bridge is injected before any app code runs. */
export function readEnvironment(): CapabilityEnv {
  const bridge = desktopBridge();
  return {
    hasDesktop: Boolean(bridge),
    protocol: typeof location !== 'undefined' ? location.protocol : 'http:',
    hasFarmDiscovery: typeof bridge?.discoverFarms === 'function',
    hasSecureStore: Boolean(bridge?.secureStore),
    hasOauthLoopback: typeof bridge?.oauthLoopback === 'function',
    hasOpenExternal: typeof bridge?.openExternal === 'function',
    hasSaveFile: typeof bridge?.saveFile === 'function',
    hasLocalStorage: localStorageWorks(),
    desktopPlatform: bridge?.platform,
    desktopVersion: bridge?.version,
  };
}

let cached: Capabilities | null = null;

/**
 * The capabilities of the running build. Computed once: neither the bridge nor the page's protocol
 * can change without a reload.
 */
export function capabilities(): Capabilities {
  if (!cached) cached = computeCapabilities(readEnvironment());
  return cached;
}

/** Test seam: forget the memoised value. */
export function resetCapabilities(): void {
  cached = null;
}
