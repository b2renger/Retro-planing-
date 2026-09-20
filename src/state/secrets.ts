/**
 * API keys and OAuth client secrets.
 *
 * Policy: when the Electron bridge exposes `window.desktop.secureStore` (OS keychain-backed), secrets
 * live there and are STRIPPED from the localStorage copies of `aiSettings` / `cloudSettings`. In the
 * plain web build there is no secure store; secrets fall back to localStorage in clear text
 * (`rps_v1_secret_<id>`) and the settings UI must say so.
 *
 * The secure store has no "list keys" call, so an index of secret ids is kept in localStorage
 * (`rps_v1_secretIds`, ids only, never values) so `loadSecrets()` can enumerate them on boot.
 *
 * Secret ids: `ai:<providerInstanceId>` for AI provider keys, `cloud:google:clientSecret` for the
 * Google desktop OAuth client secret.
 */
import { NAMESPACE } from './persistence';

const INDEX_KEY = `${NAMESPACE}secretIds`;
const VALUE_PREFIX = `${NAMESPACE}secret_`;

export type SecretsBackend = 'secure-store' | 'local-storage' | 'none';

interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function secureStore(): SecureStore | null {
  const w = globalThis as { desktop?: { secureStore?: SecureStore } };
  return w.desktop?.secureStore ?? null;
}

function localStore(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** Which backend `saveSecret` will use right now. */
export function secretsBackend(): SecretsBackend {
  if (secureStore()) return 'secure-store';
  if (localStore()) return 'local-storage';
  return 'none';
}

/** True when secrets are kept out of localStorage. */
export function hasSecureStore(): boolean {
  return secureStore() !== null;
}

export function aiSecretId(providerInstanceId: string): string {
  return `ai:${providerInstanceId}`;
}

export const GOOGLE_CLIENT_SECRET_ID = 'cloud:google:clientSecret';

function readIndex(): string[] {
  const ls = localStore();
  if (!ls) return [];
  try {
    const raw = ls.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  const ls = localStore();
  if (!ls) return;
  try {
    ls.setItem(INDEX_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* index is best-effort; the secret itself is already stored */
  }
}

/** Loads every known secret as `{ [id]: value }`. Missing or unreadable entries are skipped. */
export async function loadSecrets(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const ids = readIndex();
  const secure = secureStore();
  const ls = localStore();
  for (const id of ids) {
    try {
      const value = secure ? await secure.get(id) : ls?.getItem(VALUE_PREFIX + id) ?? null;
      if (typeof value === 'string' && value) out[id] = value;
    } catch (err) {
      console.warn(`[secrets] could not read "${id}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

export async function saveSecret(id: string, value: string): Promise<void> {
  if (!value) return deleteSecret(id);
  const secure = secureStore();
  if (secure) {
    await secure.set(id, value);
    // Make sure no clear-text copy survives from a pre-Electron session.
    try {
      localStore()?.removeItem(VALUE_PREFIX + id);
    } catch {
      /* ignore */
    }
  } else {
    const ls = localStore();
    if (!ls) throw new Error('No storage is available for secrets.');
    ls.setItem(VALUE_PREFIX + id, value);
  }
  writeIndex([...readIndex(), id]);
}

export async function deleteSecret(id: string): Promise<void> {
  const secure = secureStore();
  try {
    if (secure) await secure.delete(id);
  } catch (err) {
    console.warn(`[secrets] could not delete "${id}" from the secure store: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    localStore()?.removeItem(VALUE_PREFIX + id);
  } catch {
    /* ignore */
  }
  writeIndex(readIndex().filter((x) => x !== id));
}
