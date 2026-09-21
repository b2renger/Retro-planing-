/**
 * Persists OAuth tokens per provider: Electron's encrypted `secureStore` when available,
 * otherwise `localStorage` (web build).
 */
import { CloudError, type CloudOAuthConfig, type CloudProviderId, type OAuthTokens } from './types';
import { isExpired, PROVIDER_OAUTH, refreshTokens } from './oauth';
import { isRecord, num, str } from './httpErrors';

/** localStorage / secureStore key for a provider's tokens. */
export function tokenStorageKey(providerId: CloudProviderId): string {
  return `rps_cloud_tokens_${providerId}`;
}

interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function localStorageStore(): KeyValueStore | null {
  const ls: unknown = typeof globalThis !== 'undefined' ? (globalThis as { localStorage?: unknown }).localStorage : undefined;
  if (!isRecord(ls)) return null;
  const s = ls as { getItem?: unknown; setItem?: unknown; removeItem?: unknown };
  if (typeof s.getItem !== 'function' || typeof s.setItem !== 'function' || typeof s.removeItem !== 'function') return null;
  return {
    get: async (key) => {
      const v: unknown = (s.getItem as (k: string) => unknown)(key);
      return typeof v === 'string' ? v : null;
    },
    set: async (key, value) => {
      (s.setItem as (k: string, v: string) => void)(key, value);
    },
    delete: async (key) => {
      (s.removeItem as (k: string) => void)(key);
    },
  };
}

function resolveStore(): KeyValueStore {
  if (typeof window !== 'undefined' && window.desktop?.secureStore) return window.desktop.secureStore;
  const ls = localStorageStore();
  if (ls) return ls;
  throw new CloudError('unknown', 'No token storage available (neither secureStore nor localStorage)');
}

/** Validates a persisted JSON blob. Returns `null` for anything malformed. */
export function parseStoredTokens(raw: string | null): OAuthTokens | null {
  if (!raw) return null;
  try {
    const j: unknown = JSON.parse(raw);
    if (!isRecord(j)) return null;
    const accessToken = str(j, 'accessToken');
    const expiresAt = num(j, 'expiresAt');
    if (!accessToken || expiresAt === undefined) return null;
    return {
      accessToken,
      expiresAt,
      refreshToken: str(j, 'refreshToken'),
      scope: str(j, 'scope'),
      tokenType: str(j, 'tokenType'),
    };
  } catch {
    return null;
  }
}

/** Stores tokens for a provider. */
export async function saveTokens(providerId: CloudProviderId, tokens: OAuthTokens): Promise<void> {
  await resolveStore().set(tokenStorageKey(providerId), JSON.stringify(tokens));
}

/** Loads tokens for a provider, or `null` when none are stored (or the blob is corrupt). */
export async function loadTokens(providerId: CloudProviderId): Promise<OAuthTokens | null> {
  return parseStoredTokens(await resolveStore().get(tokenStorageKey(providerId)));
}

/** Forgets the tokens of a provider (sign-out). */
export async function clearTokens(providerId: CloudProviderId): Promise<void> {
  await resolveStore().delete(tokenStorageKey(providerId));
}

/** In-flight refreshes, deduplicated per provider so concurrent calls share one request. */
const pendingRefresh = new Map<CloudProviderId, Promise<OAuthTokens>>();

/**
 * Returns a usable access token, refreshing it first when expired.
 * Throws `CloudError('auth')` when nothing is stored or no refresh is possible — the UI should
 * then ask the user to reconnect.
 */
export async function getValidAccessToken(providerId: CloudProviderId, cfg: CloudOAuthConfig): Promise<string> {
  const tokens = await loadTokens(providerId);
  if (!tokens) throw new CloudError('auth', `Not connected to ${providerId} — reconnect required`, undefined, 'not_connected');
  if (!isExpired(tokens)) return tokens.accessToken;
  if (!tokens.refreshToken) {
    // The web implicit flow issues no refresh token, so every expiry lands here.
    throw new CloudError('auth', `The ${providerId} session has expired — reconnect required`, undefined, 'expired_token');
  }
  let pending = pendingRefresh.get(providerId);
  if (!pending) {
    const spec = PROVIDER_OAUTH[providerId];
    pending = refreshTokens({
      tokenEndpoint: spec.tokenEndpoint,
      clientId: cfg.clientId,
      clientSecret: providerId === 'google' ? cfg.clientSecret : undefined,
      refreshToken: tokens.refreshToken,
    })
      .then(async (fresh) => {
        await saveTokens(providerId, fresh);
        return fresh;
      })
      .finally(() => pendingRefresh.delete(providerId));
    pendingRefresh.set(providerId, pending);
  }
  try {
    return (await pending).accessToken;
  } catch (err) {
    // `invalid_grant` is the expected weekly expiry of a Testing-mode Google refresh token.
    // It keeps its code so the UI can offer a calm Reconnect instead of reporting a sync failure.
    if (err instanceof CloudError && err.code === 'invalid_grant') {
      throw new CloudError('auth', `Your ${providerId} sign-in has expired — sign in again to resume syncing`, err.status, 'invalid_grant');
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new CloudError('auth', `Could not refresh the ${providerId} session (${msg}) — reconnect required`, undefined, err instanceof CloudError ? err.code : undefined);
  }
}
